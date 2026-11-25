using System.Net.Http.Headers;
using System.Text.Json.Nodes;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.TwoFactor;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DemoSeeder;

/// <summary>
/// Seeds demo data into ONE existing gym. Users are bootstrapped with the app's own services and
/// password hasher; everything else goes through the HTTP API as the right demo user. Every created
/// id is written to the manifest as it happens, so a re-run skips what exists (no duplicates).
/// </summary>
public sealed class Seeder(DemoApiFactory factory, HttpClient http, ulong tenantId, string qaDir)
{
    private const string D = DemoGuard.DemoDomain;
    private readonly Manifest m = Manifest.Load(Path.Combine(qaDir, "demo-seed-manifest.local.json"));
    private readonly Credentials creds = Credentials.Load(Path.Combine(qaDir, "demo-credentials.local.json"));
    private readonly Dictionary<string, Api> sessions = [];
    private readonly List<string> errors = [];
    private static readonly TimeSpan Ist = TimeSpan.FromMinutes(330);
    private ulong branchId;

    // ── People ─────────────────────────────────────────────────────────────
    private sealed record Person(string Key, string First, string Last, string Email, string? Gender = null, DateOnly? Dob = null, string? Phone = null);

    private static readonly Person Admin = new("admin", "Demo", "Admin", "demo.admin" + D);
    private static readonly Person Staff = new("staff", "Demo", "Front Desk", "demo.frontdesk" + D);
    private static readonly Person[] Trainers =
    [
        new("trainer1", "Arjun", "Mehta (Demo)", "demo.trainer.arjun" + D, "male", new DateOnly(1990, 4, 12), "+919000000101"),
        new("trainer2", "Kavya", "Iyer (Demo)", "demo.trainer.kavya" + D, "female", new DateOnly(1993, 9, 3), "+919000000102"),
    ];
    private static readonly Person[] Members =
    [
        new("member1", "Priya", "Sharma (Demo)", "demo.priya" + D, "female", new DateOnly(1995, 2, 14), "+919000000201"),
        new("member2", "Rahul", "Verma (Demo)", "demo.rahul" + D, "male", new DateOnly(1988, 7, 30), "+919000000202"),
        new("member3", "Ananya", "Gupta (Demo)", "demo.ananya" + D, "female", new DateOnly(1999, 11, 5), "+919000000203"),
        new("member4", "Vikram", "Singh (Demo)", "demo.vikram" + D, "male", new DateOnly(1985, 1, 22), "+919000000204"),
        new("member5", "Kabir", "Rao (Demo, under 18)", "demo.kabir" + D, "male", new DateOnly(2010, 6, 18), "+919000000205"),
        new("member6", "Meera", "Nair (Demo, no membership)", "demo.meera" + D, "female", new DateOnly(1997, 3, 9), "+919000000206"),
    ];

    private ulong U(string key) => m.Id("user." + key);
    private ulong TrainerProfile(int n) => m.Id($"trainerProfile.trainer{n}");

    public async Task<int> RunAsync()
    {
        if (m.TenantId != 0 && m.TenantId != tenantId)
        {
            Console.WriteLine($"Manifest belongs to tenant {m.TenantId}; refusing to seed tenant {tenantId}.");
            return 3;
        }
        m.TenantId = tenantId;
        if (m.FirstRunAt == default) m.FirstRunAt = DateTime.UtcNow;
        m.LastRunAt = DateTime.UtcNow;
        m.Save();
        creds.Save();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId)
                         ?? throw new InvalidOperationException($"Tenant {tenantId} not found.");
            branchId = await db.Branches.Where(b => b.TenantId == tenantId).OrderBy(b => b.Id).Select(b => b.Id).FirstAsync();
            m.BranchId = branchId;
            Console.WriteLine($"Seeding '{tenant.Name}' (tenant {tenantId}), branch {branchId}.");
        }

        foreach (var key in m.Items.Where(i => i.Value.Entity == "User").Select(i => i.Value.Id)) DemoGuard.DemoUserIds.Add(key);
        DemoGuard.Enabled = true;

        await Step("users.bootstrap", BootstrapUsersAsync);
        await Step("users.api", CreateUsersViaApiAsync);
        await Step("access.overrides", AccessOverridesAsync);
        await Step("members.tags-notes", TagsAndNotesAsync);
        await Step("branch.hours", BranchHoursAsync);
        await Step("billing", BillingAsync);
        await Step("safety", SafetyAsync);
        await Step("classes", ClassesAsync);
        await Step("pt", PtAsync);
        await Step("attendance", AttendanceAsync);
        await Step("training.library", TrainingLibraryAsync);
        await Step("training.plan", TrainingPlanAsync);
        await Step("training.logs", TrainingLogsAsync);
        await Step("progress", ProgressAsync);
        await Step("announcements", AnnouncementsAsync);
        await Step("service-status", ServiceStatusAsync);
        await Step("notification-prefs", NotificationPrefsAsync);
        await Step("support", SupportAsync);
        await Step("facilities", FacilitiesAsync);
        await Step("incidents", IncidentsAsync);
        await Step("messaging", MessagingAsync);
        await Step("self-service", SelfServiceAsync);
        await Step("shop", ShopAsync);
        await Step("social", SocialAsync);
        await Step("challenges", ChallengesAsync);
        await Step("leads", LeadsAsync);
        await Step("corporate", CorporateAsync);
        await Step("privacy", PrivacyAsync);
        await Step("classes.past-attendance", PastAttendanceAsync);
        await Step("two-factor", TwoFactorAsync);

        DemoGuard.Enabled = false;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var problems = await Closure.VerifyItemsAsync(db, m);
            foreach (var p in problems) Console.WriteLine("  VERIFY: " + p);
            if (problems.Count > 0) throw new InvalidOperationException("Manifest verification failed; fix the items above before relying on cleanup.");
            var counts = await Closure.ComputeAsync(db, m);
            m.Save();
            Console.WriteLine("\nManifest rows by entity (items + derived):");
            foreach (var (k, v) in counts.OrderBy(x => x.Key)) Console.WriteLine($"  {k,-28} {v}");
        }

        Console.WriteLine($"\nSuppressed for non-demo recipients: {DemoGuard.SuppressedNotifications} in-app notifications, {DemoGuard.SuppressedOutbound} pushes/emails.");
        Console.WriteLine("\nSteps:");
        foreach (var (k, v) in m.Steps.Where(s => !s.Key.Contains('#'))) Console.WriteLine($"  {k,-26} {v}");
        if (errors.Count > 0)
        {
            Console.WriteLine("\nErrors:");
            foreach (var e in errors) Console.WriteLine("  " + e);
        }
        return 0;
    }

    // ── Plumbing ───────────────────────────────────────────────────────────

    private async Task Step(string name, Func<Task> body)
    {
        if (m.Steps.TryGetValue(name, out var s) && (s == "done" || s.StartsWith("skipped"))) { Console.WriteLine($"= {name}: {s} (earlier run)"); return; }
        Console.WriteLine($"> {name}");
        try
        {
            await body();
            if (!m.Steps.TryGetValue(name, out var now) || !now.StartsWith("skipped")) m.Steps[name] = "done";
        }
        catch (ApiException ex) when (ModuleMissing(ex))
        {
            Skip(name, "admin module not available: " + ModuleName(ex));
        }
        catch (Exception ex)
        {
            var msg = ex is ApiException ? ex.Message : ex.GetType().Name + ": " + ex.Message;
            m.Steps[name] = "error: " + Short(msg);
            errors.Add($"[{name}] {msg}");
            Console.WriteLine($"  ! {Short(msg, 400)}");
        }
        m.Save();
    }

    /// <summary>
    /// 403 "You don't have … access to the 'x' module": the live DB's module master predates these
    /// modules (the app's boot seed hasn't run with this code), so nobody — including the gym's own
    /// admin — holds them yet. Seeding the module master would change real role grants, so not done.
    /// </summary>
    private static bool ModuleMissing(ApiException e) => e.Status == 403 && e.Body.Contains("access to the", StringComparison.Ordinal);
    private static string ModuleName(ApiException e)
    {
        var i = e.Body.IndexOf("access to the", StringComparison.Ordinal);
        return i < 0 ? e.Path : e.Body[(i + 14)..].Split("module")[0].Replace("\u0027", "'").Trim() + $" module ({e.Method} {e.Path})";
    }

    private void Skip(string step, string reason) { m.Steps[step] = "skipped: " + reason; m.Save(); Console.WriteLine($"  - skipped: {reason}"); }
    private void Note(string text) { if (!m.Notes.Contains(text)) m.Notes.Add(text); m.Save(); Console.WriteLine($"  note: {text}"); }
    private static string Short(string s, int n = 300) => s.Length > n ? s[..n] + "…" : s;

    /// <summary>Creates once: returns the stored id when the key exists, otherwise runs create and stores the id.</summary>
    private async Task<ulong> Ensure(string key, string entity, Func<Task<ulong>> create)
    {
        if (m.Get(key) is { } id) return id;
        id = await create();
        m.Put(key, entity, id);
        return id;
    }

    /// <summary>Runs an action once (a sub-step without its own id, e.g. a booking or a status change).</summary>
    private async Task Once(string key, Func<Task> action)
    {
        var k = "#" + key;
        if (m.Steps.TryGetValue(k, out var s) && s == "done") return;
        await action();
        m.Steps[k] = "done";
        m.Save();
    }

    /// <summary>Like Once, but a failure is recorded and the step carries on.</summary>
    private async Task Try(string key, Func<Task> action)
    {
        try { await Once(key, action); }
        catch (ApiException ex)
        {
            errors.Add($"[{key}] {ex.Message}");
            m.Steps["#" + key] = "error: " + Short(ex.Message);
            m.Save();
            Console.WriteLine($"  ! {key}: {Short(ex.Message, 300)}");
        }
    }

    private async Task<Api> As(string key)
    {
        if (sessions.TryGetValue(key, out var api) && api.Token is not null) return api;
        var acct = creds.Accounts[key];
        api = new Api(http, key);
        var res = await api.Post("/api/auth/login", new { email = acct.Email, password = acct.Password });
        if (res?["requiresTwoFactor"]?.GetValue<bool>() == true)
        {
            var secret = Totp.FromBase32(acct.TotpSecret ?? throw new InvalidOperationException($"{key} needs 2FA but no secret is stored."));
            var code = Totp.Compute(secret, Totp.TimeStep(DateTimeOffset.UtcNow));
            res = await api.Post("/api/auth/2fa/verify", new { challengeToken = J.Str(res, "challengeToken"), code, method = "totp", rememberDevice = false });
        }
        api.Token = J.Str(res, "accessToken");
        sessions[key] = api;
        return api;
    }

    private static string Ymd(DateOnly d) => d.ToString("yyyy-MM-dd");
    private static DateOnly TodayIst => DateOnly.FromDateTime(DateTime.UtcNow + Ist);
    /// <summary>A gym-local (IST) wall-clock time as UTC.</summary>
    private static DateTime AtIst(DateOnly d, int h, int min = 0) => DateTime.SpecifyKind(d.ToDateTime(new TimeOnly(h, min)) - Ist, DateTimeKind.Utc);

    private void SetPassword(AppDbContext db, ulong userId, string password)
    {
        var u = db.Users.First(x => x.Id == userId);
        u.PasswordHash = PasswordHasher.Hash(password);
        u.Status = GymManagmentApplication.Domain.Enums.UserStatus.Active;
        u.EmailVerifiedAt ??= DateTime.UtcNow;
        u.UpdatedAt = DateTime.UtcNow;
    }

    private void SaveAccount(string key, Person p, string role, ulong userId)
    {
        if (!creds.Accounts.TryGetValue(key, out var a))
            creds.Accounts[key] = a = new Credentials.Account { Email = p.Email, Password = Credentials.NewPassword(), Role = role };
        a.UserId = userId;
        creds.Save();
        DemoGuard.DemoUserIds.Add(userId);
    }

    // ── 1. Users ───────────────────────────────────────────────────────────

    /// <summary>Demo admin (needed to call admin APIs) and the front-desk staff user, via the app's own user factory.</summary>
    private async Task BootstrapUsersAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var auth = scope.ServiceProvider.GetRequiredService<IAuthService>();
        foreach (var (p, role) in new[] { (Admin, RoleNames.Admin), (Staff, RoleNames.Staff) })
        {
            if (!creds.Accounts.ContainsKey(p.Key))
                creds.Accounts[p.Key] = new Credentials.Account { Email = p.Email, Password = Credentials.NewPassword(), Role = role };
            creds.Save();
            var id = await Ensure("user." + p.Key, "User", async () =>
            {
                var u = await auth.CreateUserAsync(new NewUser(tenantId, branchId, role, p.Email, creds.Accounts[p.Key].Password, p.First, p.Last))
                        ?? throw new InvalidOperationException($"{p.Email} already exists but is not in the manifest — resolve by hand.");
                u.EmailVerifiedAt = DateTime.UtcNow;
                u.Notes = "[Demo] QA demo account (tools/qa/DemoSeeder).";
                await db.SaveChangesAsync();
                return u.Id;
            });
            SaveAccount(p.Key, p, role, id);
        }
    }

    /// <summary>Trainers and members through the admin API (profiles, trainer assignment), then strong passwords.</summary>
    private async Task CreateUsersViaApiAsync()
    {
        var admin = await As("admin");
        for (var i = 0; i < Trainers.Length; i++)
        {
            var p = Trainers[i];
            var profileId = await Ensure($"trainerProfile.{p.Key}", "TrainerProfile", async () => J.Id(await admin.Post("/api/trainers", new
            {
                branchId, trainerCode = $"DEMO-T{i + 1}", displayName = $"{p.First} {p.Last}", email = p.Email, phone = p.Phone,
                gender = p.Gender, dateOfBirth = p.Dob, bio = "[Demo] Certified coach used for demo data. Not a real person.",
                experienceYears = 5 + i * 2, specializations = i == 0 ? new[] { "Strength", "HIIT" } : new[] { "Yoga", "Mobility" },
                languagesKnown = new[] { "English", "Hindi" },
                bookingSettings = new { canTakePersonalTraining = true, canTakeGroupClasses = true, maxClients = 20, sessionDurationMinutes = 60 },
                notes = "[Demo] record",
            })));
            var userId = await Ensure($"user.{p.Key}", "User", async () =>
                J.Id(await admin.Get($"/api/trainers/{profileId}"), "userId"));
            SaveAccount(p.Key, p, RoleNames.Trainer, userId);
        }

        // 3 members → trainer 1, 2 → trainer 2, the last one unassigned.
        var trainerFor = new ulong?[] { TrainerProfile(1), TrainerProfile(1), TrainerProfile(1), TrainerProfile(2), TrainerProfile(2), null };
        for (var i = 0; i < Members.Length; i++)
        {
            var p = Members[i];
            var id = await Ensure($"user.{p.Key}", "User", async () => J.Id(await admin.Post("/api/members", new
            {
                email = p.Email, firstName = p.First, lastName = p.Last, phone = p.Phone, gender = p.Gender, dob = p.Dob,
                notes = "[Demo] QA demo member (tools/qa/DemoSeeder).", branchId, trainerId = trainerFor[i],
            })));
            SaveAccount(p.Key, p, RoleNames.Client, id);
        }

        // Replace the default "<First>@123" passwords with generated strong ones.
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        foreach (var key in Trainers.Concat(Members).Select(p => p.Key))
            if (m.Steps.GetValueOrDefault("#pw." + key) != "done")
            {
                SetPassword(db, U(key), creds.Accounts[key].Password);
                await db.SaveChangesAsync();
                m.Steps["#pw." + key] = "done";
                m.Save();
            }
    }

    /// <summary>Per-user module grants on the demo users only (the gym's role grants are left as they are).</summary>
    private async Task AccessOverridesAsync()
    {
        var admin = await As("admin");
        object O(string k) => new { moduleKey = k, isEnabled = true, canAdd = true, canEdit = true, canDelete = false };
        await Once("access.staff", () => admin.Put($"/api/access/users/{U("staff")}/overrides", new
        {
            overrides = new[] { "admin.home", "admin.members", "admin.classes", "admin.more", "admin.attendance" }.Select(O).ToArray(),
        }));
        foreach (var t in new[] { "trainer1", "trainer2" })
            await Once("access." + t, () => admin.Put($"/api/access/users/{U(t)}/overrides", new
            {
                overrides = new[] { "trainer.programs", "trainer.programs.workouts", "trainer.programs.plans", "trainer.programs.exercises" }.Select(O).ToArray(),
            }));
        foreach (var p in Members)
            await Once("access." + p.Key, () => admin.Put($"/api/access/users/{U(p.Key)}/overrides", new
            {
                overrides = new[]
                {
                    "member.train", "member.train.workouts", "member.train.exercises", "member.progress", "member.plans",
                    "member.community", "member.community.challenges", "member.stats", "member.social",
                }.Select(O).ToArray(),
            }));
        Note("Demo staff uses the gym's existing built-in 'staff' role; its modules come from per-user overrides on the demo user (role grants untouched).");
    }

    private async Task TagsAndNotesAsync()
    {
        var admin = await As("admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (m.Get("tag.demo") is null && await db.Tags.AnyAsync(t => t.TenantId == tenantId && t.Name == "demo"))
                Note("Tag 'demo' already existed before seeding; it is NOT in the manifest (only its demo links are).");
        }
        foreach (var p in Members)
            await Once("tag." + p.Key, () => admin.Post($"/api/members/{U(p.Key)}/tags", new { tags = new[] { "demo" } }));
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var tag = await db.Tags.FirstAsync(t => t.TenantId == tenantId && t.Name == "demo");
            if (m.Get("tag.demo") is null && !m.Notes.Any(n => n.StartsWith("Tag 'demo' already existed"))) m.Put("tag.demo", "Tag", tag.Id);
        }
        var t1 = await As("trainer1");
        await Try("note.member1", () => t1.Post($"/api/members/{U("member1")}/notes", new { note = "[Demo] Goal: first pull-up by January. Mild left-knee niggle; prefer goblet squats over back squats." }));
    }

    // ── 2. Branch hours / profile ──────────────────────────────────────────

    private async Task BranchHoursAsync()
    {
        var admin = await As("admin");
        var ops = await admin.Get("/api/operations/settings");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasHours = await db.BranchOpeningIntervals.AnyAsync(i => i.BranchId == branchId);
        var hasProfile = await db.BranchProfiles.AnyAsync(i => i.BranchId == branchId);
        var ours = m.Items.Keys.Any(k => k.StartsWith("branchHours."));

        if (ops?["blockSelfCheckInOutsideHours"]?.GetValue<bool>() == true)
            Note("Branch hours NOT added: the gym blocks self check-in outside opening hours, so new hours would change real members' check-in.");
        else if (hasHours && !ours)
            Note("Branch already has opening hours; left untouched.");
        else if (!hasHours)
        {
            var weekdays = new { opens = "06:00", closes = "22:00" };
            await admin.Put($"/api/branches/{branchId}/hours/weekly", new
            {
                days = Enumerable.Range(0, 7).Select(d => new
                {
                    day = d,
                    intervals = d == 0 ? new object[] { new { opens = "08:00", closes = "13:00" } } : new object[] { weekdays },
                }).ToArray(),
            });
            foreach (var row in await db.BranchOpeningIntervals.Where(i => i.BranchId == branchId).ToListAsync())
                m.Put($"branchHours.{row.Id}", "BranchOpeningInterval", row.Id);
        }

        if (hasProfile && m.Get("branchProfile") is null) Note("Branch already has a profile; left untouched.");
        else if (!hasProfile)
        {
            await admin.Put($"/api/branches/{branchId}/profile", new
            {
                amenities = "[Demo] Lockers, showers, filtered water, free Wi-Fi, parking",
                accessibility = "[Demo] Step-free entrance and accessible washroom on the ground floor",
            });
            var prof = await db.BranchProfiles.FirstAsync(i => i.BranchId == branchId);
            m.Put("branchProfile", "BranchProfile", prof.Id);
        }
    }

    // ── 3. Billing ─────────────────────────────────────────────────────────

    private async Task BillingAsync()
    {
        var admin = await As("admin");
        var monthly = await Ensure("plan.monthly", "MembershipPlan", async () => J.Id(await admin.Post("/api/membership-plans", new
        {
            branchId, name = "[Demo] Monthly", description = "[Demo] Demo plan — not for sale.", price = 1999, currency = "INR",
            billingCycle = "monthly", durationDays = 30, features = new[] { "Gym floor", "2 classes / week" }, isPublic = false,
            joiningFee = 0, classCredits = 8, ptSessions = 0, accessHours = "06:00-22:00",
        })));
        var annual = await Ensure("plan.annual", "MembershipPlan", async () => J.Id(await admin.Post("/api/membership-plans", new
        {
            branchId, name = "[Demo] Annual", description = "[Demo] Demo plan — not for sale.", price = 19999, currency = "INR",
            billingCycle = "annual", durationDays = 365, features = new[] { "Gym floor", "Unlimited classes", "4 PT sessions" }, isPublic = false,
            joiningFee = 0, classCredits = 0, ptSessions = 4,
        })));
        await Ensure("coupon.membership", "Coupon", async () => J.Id(await admin.Post("/api/pricing/discounts", new
        {
            code = "DEMO10", discountType = "percentage", value = 10, maxUses = 5, expiresAt = DateTime.UtcNow.AddDays(60),
            applicablePlanIds = new[] { monthly, annual },
        })));

        var today = TodayIst;
        // member1 monthly paid cash at the desk, member2 annual paid by UPI, member3 monthly left due,
        // member4 monthly paid cash, member5 (under 18) monthly paid cash, member6 none.
        var subs = new (string Member, ulong Plan, string? Pay, int StartOffset)[]
        {
            ("member1", monthly, "cash", -12), ("member2", annual, "upi", -40), ("member3", monthly, null, -3),
            ("member4", monthly, "cash", -20), ("member5", monthly, "cash", -5),
        };
        foreach (var s in subs)
        {
            var res = (JsonNode?)null;
            var id = await Ensure($"membership.{s.Member}", "GymMembership", async () =>
            {
                res = await admin.Post("/api/subscriptions", new
                {
                    branchId, memberId = U(s.Member), planId = s.Plan, startDate = Ymd(today.AddDays(s.StartOffset)), taxPercent = 18, discount = 0,
                    payNowMethod = s.Pay, paymentReference = s.Pay is null ? null : $"DEMO-DESK-{s.Member.ToUpperInvariant()}",
                });
                return J.Id(res);
            });
            if (res is not null && J.TryId(res, "invoiceId") is { } inv) m.Put($"invoice.membership.{s.Member}", "Invoice", inv);
        }

        // A standalone invoice (PT pack) for member3, then a desk (cash) payment against it.
        var invoiceId = await Ensure("invoice.ptpack.member3", "Invoice", async () => J.Id(await admin.Post("/api/invoices", new
        {
            memberId = U("member3"), items = new[] { new { description = "[Demo] PT pack — 4 sessions", unitPrice = 4000, quantity = 1 } },
            notes = "[Demo] invoice", dueDate = Ymd(today.AddDays(7)), taxPercent = 18, discount = 0,
        })));
        await Once("invoice.ptpack.member3.paid", () => admin.Put($"/api/invoices/{invoiceId}/mark-paid", new { method = "cash", reference = "DEMO-DESK-PT-001" }));
        Note("No online/Razorpay payments: memberships were paid at the desk (cash/UPI reference) or left due.");
    }

    // ── 4. Safety ──────────────────────────────────────────────────────────

    private async Task SafetyAsync()
    {
        var admin = await As("admin");
        JsonNode? settings;
        List<JsonNode> waivers;
        try
        {
            settings = await admin.Get("/api/safety/admin/settings");
            waivers = J.Items(await admin.Get("/api/safety/admin/waivers")).ToList();
        }
        catch (ApiException ex) when (ModuleMissing(ex))
        {
            Note("Waivers: admin module 'waivers' is not in the live module master, so the gym's waiver list can't be read and no [Demo] waiver was published; members only signed waivers already pending for them (none).");
            settings = null; waivers = [new JsonObject { ["isActive"] = true, ["id"] = 0 }];
        }
        var ourWaiver = m.Get("waiver.demo");
        var active = waivers.Where(w => w["isActive"]?.GetValue<bool>() != false && J.TryId(w) != ourWaiver).ToList();
        if (active.Count == 0 && ourWaiver is null)
        {
            if (settings?["gatingEnabled"]?.GetValue<bool>() == true)
                Note("Safety gating is ON: publishing a placeholder waiver would block real members, so no [Demo] waiver was published.");
            else
            {
                await Ensure("waiver.demo", "WaiverDocument", async () => J.Id(await admin.Post("/api/safety/admin/waivers", new
                {
                    title = "[Demo] Liability waiver (placeholder)",
                    body = "[Demo] PLACEHOLDER TEXT ONLY — replace with your gym's real waiver before going live.\n\n" +
                           "I understand that exercise carries a risk of injury. I will follow staff instructions, use equipment safely " +
                           "and tell staff about any health condition that may affect my training.",
                })));
                Note("The gym had no active waiver, so a [Demo] placeholder waiver was published (members see it as pending until it is archived/removed).");
            }
        }
        else if (active.Count > 0 && settings is not null) Note("The gym already has an active waiver; demo members signed it (no demo waiver created).");

        foreach (var p in Members)
        {
            var api = await As(p.Key);
            await Try($"safety.waivers.{p.Key}", async () =>
            {
                foreach (var w in J.Items(await api.Get("/api/safety/me/waivers/pending")))
                {
                    var versionId = J.TryId(w, "versionId") ?? J.Id(w);
                    await api.Post($"/api/safety/me/waivers/{versionId}/sign", new { signedName = $"{p.First} {p.Last}", agreed = true });
                }
            });
            await Try($"safety.health.{p.Key}", async () =>
            {
                var qs = await api.Get("/api/safety/me/health/questions");
                var n = J.Items(qs).Count();
                if (n == 0 && qs?["questions"] is JsonArray qa) n = qa.Count;
                var answers = Enumerable.Range(0, Math.Max(n, 1)).Select(i => p.Key == "member3" && i == 0).ToArray();
                await api.Post("/api/safety/me/health", new
                {
                    answers, conditions = p.Key == "member3" ? "[Demo] Mild asthma, uses an inhaler" : null,
                    medications = p.Key == "member3" ? "[Demo] Salbutamol inhaler as needed" : null,
                    injuries = p.Key == "member1" ? "[Demo] Old left-knee sprain (2023), fully recovered" : null,
                    grantHealthDataConsent = true,
                });
            });
            await Try($"safety.emergency.{p.Key}", () => api.Put("/api/safety/me/emergency-contact", new
            {
                name = p.Key == "member5" ? "Sunita Rao (Demo parent)" : $"Demo Contact for {p.First}",
                relationship = p.Key == "member5" ? "parent" : "spouse", phone = "+919000000999",
            }));
            await Try($"safety.consents.{p.Key}", async () =>
            {
                await api.Post("/api/consents/me", new { type = "marketing_email", granted = p.Key is "member1" or "member2", version = "demo-1", source = "app" });
                await api.Post("/api/consents/me", new { type = "photo_media", granted = p.Key != "member5", version = "demo-1", source = "app" });
            });
        }
    }

    // ── 5. Classes, PT, attendance ─────────────────────────────────────────

    private async Task ClassesAsync()
    {
        var admin = await As("admin");
        var hiit = await Ensure("classType.hiit", "ClassType", async () => J.Id(await admin.Post("/api/classes/types", new
        { name = "[Demo] HIIT", description = "[Demo] 45-minute high-intensity intervals.", durationMin = 45, maxCapacity = 3, color = "#E4572E", isActive = true })));
        var yoga = await Ensure("classType.yoga", "ClassType", async () => J.Id(await admin.Post("/api/classes/types", new
        { name = "[Demo] Yoga Flow", description = "[Demo] 60-minute vinyasa flow.", durationMin = 60, maxCapacity = 12, color = "#4C9F70", isActive = true })));

        var today = TodayIst;
        var plan = new (string Key, ulong Type, int Day, int Hour, int Cap, int Trainer, string Title)[]
        {
            ("class.hiit1", hiit, 1, 7, 3, 1, "[Demo] Morning HIIT"),
            ("class.yoga1", yoga, 2, 18, 12, 2, "[Demo] Sunset Yoga"),
            ("class.hiit2", hiit, 4, 7, 10, 1, "[Demo] Morning HIIT"),
            ("class.yoga2", yoga, 6, 18, 12, 2, "[Demo] Sunset Yoga"),
        };
        // Adopt classes an earlier run created but could not record (response-shape bug in run 1).
        async Task<ulong?> Adopt(string title, DateTime? startsAt)
        {
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var known = m.Items.Values.Where(i => i.Entity == "GymClass").Select(i => i.Id).ToList();
            var id = await db.GymClasses.Where(c => c.TenantId == tenantId && c.Title == title && !known.Contains(c.Id)
                                                    && (startsAt == null || c.StartsAt == startsAt) && c.Notes == "[Demo] class")
                .OrderBy(c => c.Id).Select(c => (ulong?)c.Id).FirstOrDefaultAsync();
            return id;
        }
        foreach (var c in plan)
            if (m.Get(c.Key) is null && await Adopt(c.Title, AtIst(today.AddDays(c.Day), c.Hour)) is { } adopted) m.Put(c.Key, "GymClass", adopted);
        if (m.Get("class.past") is null && await Adopt("[Demo] Lunchtime HIIT (attendance demo)", null) is { } adoptedPast) m.Put("class.past", "GymClass", adoptedPast);
        foreach (var c in plan)
            await Ensure(c.Key, "GymClass", async () => J.Id(await admin.Post("/api/classes", new
            {
                classTypeId = c.Type, branchId, trainerId = TrainerProfile(c.Trainer), title = c.Title,
                startsAt = AtIst(today.AddDays(c.Day), c.Hour), durationMin = c.Type == hiit ? 45 : 60, maxCapacity = c.Cap,
                notes = "[Demo] class", repeatWeeks = 0,
            })));

        // A class starting in ~2 minutes: booked now, attendance (incl. a no-show) marked once it has started.
        await Ensure("class.past", "GymClass", async () => J.Id(await admin.Post("/api/classes", new
        {
            classTypeId = hiit, branchId, trainerId = TrainerProfile(1), title = "[Demo] Lunchtime HIIT (attendance demo)",
            startsAt = DateTime.UtcNow.AddMinutes(2), durationMin = 30, maxCapacity = 10, notes = "[Demo] class", repeatWeeks = 0,
        })));
        foreach (var mem in new[] { "member1", "member2", "member3" })
            await Try($"book.past.{mem}", () => admin.Post($"/api/classes/{m.Id("class.past")}/book", new { clientId = U(mem) }));

        // Members book themselves; hiit1 has 3 seats, so the 4th booking lands on the waitlist.
        var bookings = new (string Class, string Member)[]
        {
            ("class.hiit1", "member1"), ("class.hiit1", "member2"), ("class.hiit1", "member3"), ("class.hiit1", "member4"),
            ("class.yoga1", "member1"), ("class.yoga1", "member5"),
            ("class.hiit2", "member2"), ("class.hiit2", "member4"),
            ("class.yoga2", "member3"),
        };
        foreach (var (cls, mem) in bookings)
        {
            var api = await As(mem);
            await Try($"book.{cls}.{mem}", () => api.Post($"/api/classes/{m.Id(cls)}/book", new { }));
        }
    }

    private async Task PtAsync()
    {
        var admin = await As("admin");
        var t1 = await As("trainer1");
        await Try("pt.schedule.trainer1", () => t1.Put($"/api/trainers/{TrainerProfile(1)}/schedule", new
        {
            slots = Enumerable.Range(1, 6).Select(d => new { dayOfWeek = d, startTime = "06:00:00", endTime = "20:00:00", isActive = true }).ToArray(),
        }));
        var type60 = await Ensure("ptType.60", "PtSessionType", async () => J.Id(await t1.Post("/api/pt/types", new
        { trainerId = TrainerProfile(1), name = "[Demo] 1:1 Strength (60 min)", durationMin = 60, price = 1200, description = "[Demo] PT session type", isActive = true })));
        await Ensure("ptType.30", "PtSessionType", async () => J.Id(await t1.Post("/api/pt/types", new
        { trainerId = TrainerProfile(1), name = "[Demo] Technique check (30 min)", durationMin = 30, price = 600, description = "[Demo] PT session type", isActive = true })));

        var today = TodayIst;
        var day = Enumerable.Range(2, 6).Select(today.AddDays).First(d => d.DayOfWeek is not DayOfWeek.Sunday);
        var m1 = await As("member1");
        var s1 = await Ensure("pt.session.member1", "PtSession", async () => J.Id(await m1.Post("/api/pt/sessions", new
        { sessionTypeId = type60, startsAt = AtIst(day, 10), notes = "[Demo] Focus: squat depth" })));
        var s2 = await Ensure("pt.session.member2", "PtSession", async () => J.Id(await admin.Post("/api/pt/sessions", new
        { sessionTypeId = type60, clientId = U("member2"), startsAt = AtIst(day.AddDays(1), 11), notes = "[Demo] Booked at the desk" })));
        await Try("pt.confirm.member1", () => t1.Put($"/api/pt/sessions/{s1}/status", new { status = "Confirmed", trainerNotes = "[Demo] See you there!" }));
    }

    private async Task AttendanceAsync()
    {
        var staff = await As("staff");
        foreach (var mem in new[] { "member1", "member2", "member4" })
            await Try($"attendance.in.{mem}", () => staff.Post($"/api/attendance/members/{U(mem)}/check-in", new { }));
        foreach (var mem in new[] { "member1", "member2" })
            await Try($"attendance.out.{mem}", () => staff.Post($"/api/attendance/members/{U(mem)}/check-out", new { }));
        Note("Desk attendance: member1 and member2 checked in and out, member4 left checked in (attendance rows are derived rows in the manifest).");
    }

    // ── 6. Training ────────────────────────────────────────────────────────

    private async Task TrainingLibraryAsync()
    {
        var admin = await As("admin");
        var existing = J.Items(await admin.Get("/api/exercises?PageNumber=1&PageSize=50")).ToList();
        var muscles = J.Items(await admin.Get("/api/exercises/muscles")).ToList();
        ulong[] Mus(params string[] names) => muscles
            .Where(x => names.Any(n => J.Str(x, "name").Contains(n, StringComparison.OrdinalIgnoreCase)))
            .Select(x => J.Id(x)).Take(3).ToArray();

        var defs = new (string Key, string Name, int Cat, int Diff, string[] Muscles, string How)[]
        {
            ("goblet-squat", "[Demo] Goblet Squat", 0, 0, ["quad", "glute"], "Hold a dumbbell at the chest, sit between the hips, drive up through mid-foot."),
            ("push-up", "[Demo] Push-up", 0, 0, ["chest", "tricep"], "Hands under shoulders, body in one line, lower the chest to a fist's height."),
            ("db-row", "[Demo] One-arm Dumbbell Row", 0, 0, ["back", "lat"], "Brace on a bench, pull the dumbbell to the hip, lower under control."),
            ("plank", "[Demo] Front Plank", 0, 0, ["core", "abs"], "Forearms down, ribs tucked, squeeze glutes, breathe."),
            ("rdl", "[Demo] Romanian Deadlift", 0, 1, ["hamstring", "glute"], "Soft knees, push the hips back, keep the bar close, stand tall."),
            ("jumping-jacks", "[Demo] Jumping Jacks", 1, 0, ["calf"], "Light, rhythmic jumps; arms overhead."),
        };
        if (existing.Count > 0) Note($"Gym library already had {existing.Count}+ exercises; demo workouts mix them with the [Demo] ones.");
        else Note("The exercise library was empty, so 6 [Demo] exercises were added (instead of 3) to build workouts from.");
        foreach (var d in defs)
            await Ensure($"exercise.{d.Key}", "Exercise", async () => J.Id(await admin.Post("/api/exercises", new
            {
                name = d.Name, description = "[Demo] exercise", instructions = d.How, category = d.Cat, difficulty = d.Diff,
                tags = new[] { "demo" }, muscleIds = Mus(d.Muscles), equipmentIds = Array.Empty<ulong>(),
            })));

        ulong E(string k) => m.Id("exercise." + k);
        var full = await Ensure("workout.fullbody", "WorkoutTemplate", async () => J.Id(await admin.Post("/api/workouts", new
        { name = "[Demo] Full Body A", description = "[Demo] 45-minute full-body strength session.", category = "strength", goal = 1, difficulty = 0, durationMin = 45, isPublic = false, tags = new[] { "demo" } })));
        await Once("structure.fullbody", () => admin.Put($"/api/workouts/{full}/structure", new
        {
            workoutId = full,
            sections = new object[]
            {
                new { name = "Warm-up", type = "warmup", rounds = 1, restSeconds = 0, exercises = new object[]
                    { new { exerciseId = E("jumping-jacks"), sets = 2, durationSeconds = 45, restSeconds = 15 } } },
                new { name = "Main lifts", type = "main", rounds = 1, restSeconds = 90, exercises = new object[]
                    {
                        new { exerciseId = E("goblet-squat"), sets = 3, reps = "10", restSeconds = 90, weightSuggestion = "16 kg" },
                        new { exerciseId = E("rdl"), sets = 3, reps = "8", restSeconds = 90, weightSuggestion = "30 kg" },
                    } },
                new { name = "Superset A", type = "superset", rounds = 3, restSeconds = 60, exercises = new object[]
                    {
                        new { exerciseId = E("push-up"), sets = 3, reps = "12", restSeconds = 0 },
                        new { exerciseId = E("db-row"), sets = 3, reps = "10", restSeconds = 60, weightSuggestion = "14 kg" },
                    } },
                new { name = "Finisher", type = "cooldown", rounds = 1, restSeconds = 0, exercises = new object[]
                    { new { exerciseId = E("plank"), sets = 2, durationSeconds = 40, restSeconds = 30 } } },
            },
        }));
        var lower = await Ensure("workout.lower", "WorkoutTemplate", async () => J.Id(await admin.Post("/api/workouts", new
        { name = "[Demo] Lower Body Strength", description = "[Demo] Squat and hinge focus.", category = "strength", goal = 1, difficulty = 1, durationMin = 40, isPublic = false, tags = new[] { "demo" } })));
        await Once("structure.lower", () => admin.Put($"/api/workouts/{lower}/structure", new
        {
            workoutId = lower,
            sections = new object[]
            {
                new { name = "Main", type = "main", rounds = 1, restSeconds = 120, exercises = new object[]
                    {
                        new { exerciseId = E("goblet-squat"), sets = 4, reps = "8", restSeconds = 120, weightSuggestion = "20 kg" },
                        new { exerciseId = E("rdl"), sets = 4, reps = "8", restSeconds = 120, weightSuggestion = "35 kg" },
                    } },
                new { name = "Core", type = "main", rounds = 1, restSeconds = 30, exercises = new object[]
                    { new { exerciseId = E("plank"), sets = 3, durationSeconds = 45, restSeconds = 30 } } },
            },
        }));
        // A one-off workout assigned directly to member4 (trainer 2's client).
        await Try("workout.assign.member4", () => admin.Post("/api/workouts/assign", new
        { workoutId = full, memberIds = new[] { U("member4") }, assignedAt = Ymd(TodayIst), dueDate = Ymd(TodayIst.AddDays(3)), notes = "[Demo] Try this before Friday." }));
    }

    private async Task TrainingPlanAsync()
    {
        var admin = await As("admin");
        ulong E(string k) => m.Id("exercise." + k);
        var planId = await Ensure("plan.4week", "WorkoutPlan", async () => J.Id(await admin.Post("/api/plans", new
        {
            name = "[Demo] 4-Week Strength Starter", description = "[Demo] 3 sessions a week with rest days between.",
            durationWeeks = 4, goal = 1, difficulty = 0, daysPerWeekHint = 3,
        }), "id"));

        async Task<JsonNode?> Day(int day, string title, bool rest) =>
            await admin.Put($"/api/plans/{planId}/weeks/1/days/{day}", new { title, notes = rest ? "[Demo] Walk 20-30 min, stretch." : "[Demo] Log every set.", isRestDay = rest });

        await Once("plan.w1.d1", async () =>
        {
            var d = await Day(1, "Full Body A", false);
            await admin.Post($"/api/plans/{planId}/days/{J.Id(d, "dayId")}/from-library", new { workoutId = m.Id("workout.fullbody"), append = false });
        });
        await Once("plan.w1.d2", () => Day(2, "Rest & mobility", true));
        await Once("plan.w1.d3", async () =>
        {
            var d = await Day(3, "Upper + Core (superset)", false);
            var wid = J.Id(d, "workoutId");
            await admin.Put($"/api/workouts/{wid}/structure", new
            {
                workoutId = wid,
                sections = new object[]
                {
                    new { name = "Superset 1", type = "superset", rounds = 3, restSeconds = 75, exercises = new object[]
                        {
                            new { exerciseId = E("push-up"), sets = 3, reps = "10", restSeconds = 0 },
                            new { exerciseId = E("db-row"), sets = 3, reps = "10", restSeconds = 75, weightSuggestion = "14 kg" },
                        } },
                    new { name = "Core", type = "main", rounds = 1, restSeconds = 30, exercises = new object[]
                        { new { exerciseId = E("plank"), sets = 3, durationSeconds = 40, restSeconds = 30 } } },
                },
            });
        });
        await Once("plan.w1.d4", () => Day(4, "Rest", true));
        await Once("plan.w1.d5", async () =>
        {
            var d = await Day(5, "Lower Body", false);
            await admin.Post($"/api/plans/{planId}/days/{J.Id(d, "dayId")}/from-library", new { workoutId = m.Id("workout.lower"), append = false });
        });
        await Once("plan.w1.d6", () => Day(6, "Active recovery", true));
        await Once("plan.w1.d7", () => Day(7, "Rest", true));
        await Once("plan.copy-week1", () => admin.Post($"/api/plans/{planId}/weeks/1/copy", new { toWeeks = new[] { 2, 3, 4 } }));

        // Assigned to member1 and member2 (trainer 1's clients), starting this week's Monday.
        var monday = TodayIst.AddDays(-(((int)TodayIst.DayOfWeek + 6) % 7));
        await Once("plan.assign", async () =>
        {
            var res = await admin.Post($"/api/plans/{planId}/assign", new
            {
                memberIds = new[] { U("member1"), U("member2") }, trainerId = TrainerProfile(1), startDate = Ymd(monday), startWeek = 1, startDay = 1, replaceExisting = false,
            });
            foreach (var a in J.Items(res))
            {
                var client = J.Id(a, "clientId");
                var key = client == U("member1") ? "member1" : "member2";
                m.Put($"planAssignment.{key}", "WorkoutPlanAssignment", J.Id(a, "assignmentId"));
                m.Put($"planCopy.{key}", "WorkoutPlan", J.Id(a, "planId"));
            }
        });
    }

    /// <summary>member1 logs plan days 1 and 3 with sets (history + PRs) and skips day 5.</summary>
    private async Task TrainingLogsAsync()
    {
        var admin = await As("admin");
        var m1 = await As("member1");
        var aid = m.Id("planAssignment.member1");
        var builder = await admin.Get($"/api/plans/assignments/{aid}/builder");
        var week1 = builder?["weeks"]?.AsArray().First(w => w?["weekNumber"]?.GetValue<int>() == 1);
        JsonNode DayN(int n) => week1!["days"]!.AsArray().First(d => d?["dayNumber"]?.GetValue<int>() == n)!;
        var monday = DateOnly.Parse(J.Str(builder?["clientAssignment"], "startDate")[..10]);

        async Task Log(int dayNo, double load)
        {
            var wid = J.Id(DayN(dayNo), "workoutId");
            var structure = await admin.Get($"/api/workouts/{wid}/structure");
            var sets = new List<object>();
            foreach (var sec in structure?["sections"]?.AsArray() ?? [])
                foreach (var ex in sec?["exercises"]?.AsArray() ?? [])
                {
                    var n = ex?["sets"]?.GetValue<int?>() ?? 3;
                    var timed = ex?["durationSeconds"]?.GetValue<int?>() is not null;
                    for (var s = 1; s <= n; s++)
                        sets.Add(new
                        {
                            exerciseId = J.Id(ex, "exerciseId"), workoutExerciseId = J.Id(ex, "workoutExerciseId"), setNo = s, setType = "normal",
                            reps = timed ? (int?)null : 10 - (s == n ? 1 : 0), weightKg = timed ? (double?)null : load + s * 2,
                            durationSec = timed ? ex!["durationSeconds"]!.GetValue<int>() : (int?)null, rpe = 7 + (s == n ? 1 : 0), completed = true,
                        });
                }
            var date = monday.AddDays(dayNo - 1);
            var res = await m1.Post($"/api/workouts/{wid}/complete", new
            {
                startedAt = AtIst(date, 7), endedAt = AtIst(date, 7, 50), calories = 320, notes = "[Demo] Felt strong.",
                moodBefore = 3, moodAfter = 4, fatigueLevel = 2, sessionRpe = 7, planAssignmentId = aid, week = 1, day = dayNo, sets,
            });
            if ((J.TryId(res, "id") ?? J.TryId(res, "logId")) is { } logId) m.Put($"workoutLog.member1.day{dayNo}", "WorkoutLog", logId);
        }

        var today = TodayIst;
        if (monday.AddDays(0) <= today) await Once("log.day1", () => Log(1, 12));
        if (monday.AddDays(2) <= today) await Once("log.day3", () => Log(3, 14));
        var skipDate = monday.AddDays(4);
        await Try("skip.day5", () => m1.Post($"/api/me/plans/{aid}/days/skip", new { date = Ymd(skipDate) }));
    }

    private async Task ProgressAsync()
    {
        var m1 = await As("member1");
        var today = TodayIst;
        var points = new (int Ago, double Kg, double Fat)[] { (21, 68.4, 27.1), (14, 67.9, 26.8), (7, 67.5, 26.4), (1, 67.1, 26.0) };
        foreach (var p in points)
            await Try($"metric.member1.{p.Ago}", () => m1.Post("/api/progress/metrics", new
            { date = Ymd(today.AddDays(-p.Ago)), weightKg = p.Kg, bodyFatPct = p.Fat, restingHr = 64, sleepHours = 7.2, steps = 8200, mood = 4, notes = "[Demo] check-in" }));
    }

    // ── 7. Communication ──────────────────────────────────────────────────

    private async Task AnnouncementsAsync()
    {
        var admin = await As("admin");
        var tag = m.Get("tag.demo") ?? J.Items((await admin.Get("/api/announcements/admin/audience-options"))?["tags"])
            .Where(t => J.Str(t, "name") == "demo").Select(t => J.Id(t)).First();
        var countNode = await admin.Get($"/api/announcements/admin/audience-count?audience=Tags&audienceIds={tag}");
        var count = countNode is JsonObject o ? o["count"]?.GetValue<int>() : countNode?.GetValue<int>();
        if (count != Members.Length)
            throw new InvalidOperationException($"Tag 'demo' reaches {count} people, expected exactly the {Members.Length} demo members — not sending.");

        await Ensure("announcement.published", "Announcement", async () => J.Id(await admin.Post("/api/announcements/admin", new
        {
            title = "[Demo] Welcome to the demo gym", body = "[Demo] This is a demo announcement, delivered only to members tagged 'demo'.",
            ctaLabel = "Book a class", ctaRoute = "book", audience = "Tags", audienceIds = new[] { tag }, isPinned = false, isUrgent = false, action = "publish",
        })));
        await Ensure("announcement.scheduled", "Announcement", async () => J.Id(await admin.Post("/api/announcements/admin", new
        {
            title = "[Demo] New HIIT slots next week", body = "[Demo] Scheduled demo announcement for members tagged 'demo'.",
            audience = "Tags", audienceIds = new[] { tag }, isPinned = false, isUrgent = false,
            publishAt = DateTime.UtcNow.AddDays(2), expiresAt = DateTime.UtcNow.AddDays(9), action = "schedule",
        })));
    }

    private async Task ServiceStatusAsync()
    {
        var admin = await As("admin");
        await Ensure("serviceStatus.sauna", "ServiceStatus", async () => J.Id(await admin.Post("/api/service-status/admin", new
        {
            branchId, area = "[Demo] Sauna", status = "Limited", severity = "Info",
            message = "[Demo] Demo notice: sauna closed for deep cleaning. Ends automatically within 24 hours.",
            startsAt = DateTime.UtcNow, endsAt = DateTime.UtcNow.AddHours(20),
        })));
    }

    private async Task NotificationPrefsAsync()
    {
        foreach (var p in Members)
        {
            var api = await As(p.Key);
            await Try("prefs." + p.Key, () => api.Put("/api/me/notification-preferences", new
            {
                categories = new object[]
                {
                    new { category = "class_reminders", push = true, email = p.Key != "member4" },
                    new { category = "marketing", push = false, email = p.Key == "member1" },
                    new { category = "announcements", push = true, email = false },
                },
                quietHoursEnabled = p.Key is "member1" or "member3", quietStart = "22:00", quietEnd = "07:00",
            }));
        }
    }

    private async Task SupportAsync()
    {
        var admin = await As("admin");
        var staff = await As("staff");
        var staffSide = true;
        try
        {
        await Ensure("faq.freeze", "SupportFaq", async () => J.Id(await admin.Post("/api/support/faqs", new
        { question = "[Demo] How do I pause my membership?", answer = "[Demo] Open Membership → Pause and pick the dates. The desk confirms within a day.", category = "billing", sortOrder = 900, isPublished = true })));
        await Ensure("faq.guest", "SupportFaq", async () => J.Id(await admin.Post("/api/support/faqs", new
        { question = "[Demo] Can I bring a guest?", answer = "[Demo] Yes — one guest pass per month at the front desk.", category = "facilities", sortOrder = 901, isPublished = true })));
        await Ensure("canned.onit", "SupportCannedReply", async () => J.Id(await admin.Post("/api/support/canned-replies", new
        { title = "[Demo] Thanks — we're on it", body = "[Demo] Thanks for letting us know! We've passed this to the team and will update you shortly.", sortOrder = 900 })));
        }
        catch (ApiException ex) when (ModuleMissing(ex))
        {
            staffSide = false;
            Note("Support: admin module 'support' is not in the live module master, so FAQ, canned replies and staff replies/internal notes were skipped; members' requests were created and one was resolved and rated by the member.");
        }

        var m1 = await As("member1");
        var m2 = await As("member2");
        var r1 = await Ensure("support.request.member1", "SupportRequest", async () => J.Id(await m1.Post("/api/me/support-requests", new
        { category = "equipment", subject = "[Demo] Treadmill 2 belt is slipping", message = "[Demo] The belt slips when running above 10 km/h.", branchId, canContact = true })));
        var r2 = await Ensure("support.request.member2", "SupportRequest", async () => J.Id(await m2.Post("/api/me/support-requests", new
        { category = "billing", subject = "[Demo] Question about my invoice", message = "[Demo] Is GST included in my annual plan invoice?", branchId, canContact = true })));

        if (!staffSide)
        {
            await Try("support.r2.member-resolve", () => m2.Post($"/api/me/support-requests/{r2}/resolve", new { }));
            await Try("support.r2.rate", () => m2.Post($"/api/me/support-requests/{r2}/rate", new { score = 5, comment = "[Demo] Sorted it myself, thanks!" }));
            return;
        }
        await Try("support.r1.reply", () => staff.Post($"/api/support/requests/{r1}/messages", new { body = "[Demo] Thanks for letting us know! We've passed this to the team.", @internal = false }));
        await Try("support.r1.note", () => staff.Post($"/api/support/requests/{r1}/messages", new { body = "[Demo] Internal: service company booked for Tuesday.", @internal = true }));
        await Try("support.r2.reply", () => staff.Post($"/api/support/requests/{r2}/messages", new { body = "[Demo] Yes, 18% GST is included — see the tax line on the invoice.", @internal = false, status = "resolved" }));
        await Try("support.r2.rate", () => m2.Post($"/api/me/support-requests/{r2}/rate", new { score = 5, comment = "[Demo] Quick and clear, thanks!" }));
    }

    private async Task FacilitiesAsync()
    {
        var admin = await As("admin");
        var today = TodayIst;
        var assets = new (string Key, string Name, string Type, string Zone, string Code, bool KeyFacility)[]
        {
            ("treadmill1", "[Demo] Treadmill 1", "equipment", "[Demo] Cardio zone", "DEMO-TM-01", false),
            ("treadmill2", "[Demo] Treadmill 2", "equipment", "[Demo] Cardio zone", "DEMO-TM-02", false),
            ("cable", "[Demo] Cable crossover", "equipment", "[Demo] Strength zone", "DEMO-CBL-01", false),
            ("sauna", "[Demo] Sauna", "facility", "[Demo] Wellness", "DEMO-SAUNA", true),
        };
        var assetsOk = true;
        try
        {
        foreach (var a in assets)
            await Ensure($"asset.{a.Key}", "FacilityAsset", async () => J.Id(await admin.Post("/api/facilities/assets", new
            {
                branchId, name = a.Name, assetType = a.Type, zone = a.Zone, assetCode = a.Code, serialNumber = "DEMO-SN-" + a.Code,
                isKeyFacility = a.KeyFacility, nextServiceDue = Ymd(today.AddDays(30)), notes = "[Demo] asset",
            })));
        await Ensure("maintenance.treadmill1", "FacilityMaintenance", async () => J.Id(await admin.Post($"/api/facilities/assets/{m.Id("asset.treadmill1")}/maintenance", new
        { performedOn = Ymd(today.AddDays(-10)), work = "[Demo] Belt tension and lubrication", performedBy = "Demo Fitness Services", cost = 1500, nextServiceDue = Ymd(today.AddDays(80)) })));
        await Ensure("maintenance.cable", "FacilityMaintenance", async () => J.Id(await admin.Post($"/api/facilities/assets/{m.Id("asset.cable")}/maintenance", new
        { performedOn = Ymd(today.AddDays(-3)), work = "[Demo] Replaced frayed cable", performedBy = "Demo Fitness Services", cost = 3200, nextServiceDue = Ymd(today.AddDays(180)) })));
        }
        catch (ApiException ex) when (ModuleMissing(ex))
        {
            assetsOk = false;
            Note("Equipment: admin module 'facilities' is not in the live module master, so [Demo] assets/maintenance were skipped; members filed problem reports against a free-text location instead.");
        }

        var m1 = await As("member1");
        var m3 = await As("member3");
        var rep1 = await Ensure("report.treadmill2", "FacilityReport", async () => J.Id(await m1.Post("/api/facility-reports", new
        { branchId, assetId = assetsOk ? m.Get("asset.treadmill2") : null, otherLocation = assetsOk ? null : "[Demo] Treadmill 2 (cardio zone)", problemType = "broken", description = "[Demo] Belt slips above 10 km/h." })));
        var rep2 = await Ensure("report.cable.unsafe", "FacilityReport", async () => J.Id(await m3.Post("/api/facility-reports", new
        { branchId, assetId = assetsOk ? m.Get("asset.cable") : null, otherLocation = assetsOk ? null : "[Demo] Cable crossover (strength zone)", problemType = "unsafe", description = "[Demo] Cable looks frayed near the pulley — unsafe to use." })));
        await Try("report.cable.plusone", async () => await (await As("member2")).Post($"/api/facility-reports/{rep2}/plus-one", new { comment = "[Demo] Same here.", @unsafe = true }));
        if (assetsOk) await Try("report.treadmill2.comment", () => admin.Post($"/api/facility-reports/admin/{rep1}/comments", new { body = "[Demo] Technician booked for Tuesday.", @internal = false }));
    }

    private async Task IncidentsAsync()
    {
        var admin = await As("admin");
        var id = await Ensure("incident.demo", "Incident", async () => J.Id(await admin.Post("/api/incidents", new
        {
            occurredAt = AtIst(TodayIst.AddDays(-1), 18, 30), branchId, location = "[Demo] Free-weights area", type = "injury", severity = "Low",
            description = "[Demo] Member strained a wrist during dumbbell rows. Demo record only.",
            firstAidGiven = true, firstAidBy = "Demo Front Desk", ambulanceCalled = false, witnesses = "[Demo] Arjun Mehta (Demo)",
            followUpActions = "[Demo] Call the member in 48 hours.", assetId = (ulong?)null,
            people = new object[] { new { kind = "member", userId = U("member3"), isInjuredParty = true, notes = "[Demo] Right wrist" } },
        })));
        await Ensure("incident.addendum", "IncidentAddendum", async () => J.Id(await admin.Post($"/api/incidents/{id}/addenda", new
        { body = "[Demo] Follow-up call made: member is fine and back training." })));
    }

    private async Task MessagingAsync()
    {
        var t1 = await As("trainer1");
        var m1 = await As("member1");
        var conv = await Ensure("conversation.trainer1.member1", "Conversation", async () => J.Id(await t1.Post("/api/messages/conversations", new { userId = U("member1") })));
        await Once("msg.1", () => t1.Post($"/api/messages/conversations/{conv}/messages", new { clientMessageId = Guid.NewGuid().ToString(), body = "[Demo] Great session today! Remember to log Wednesday's workout." }));
        await Once("msg.2", () => m1.Post($"/api/messages/conversations/{conv}/messages", new { clientMessageId = Guid.NewGuid().ToString(), body = "[Demo] Will do, thanks coach!" }));
        await Try("msg.read", () => t1.Post($"/api/messages/conversations/{conv}/read", new { }));
    }

    // ── 8. Self-service, shop, social, community ─────────────────────────

    private async Task SelfServiceAsync()
    {
        var admin = await As("admin");
        var today = TodayIst;
        var m1 = await As("member1");
        var mem1 = m.Id("membership.member1");
        var freeze = await Ensure("membershipRequest.freeze.member1", "MembershipRequest", async () => J.Id(await m1.Post("/api/me/membership-requests", new
        { type = "freeze", membershipId = mem1, from = Ymd(today.AddDays(10)), to = Ymd(today.AddDays(20)), reason = "[Demo] Travelling for work" })));
        await Try("membershipRequest.freeze.approve", async () =>
        {
            var r = await admin.Get($"/api/membership-requests/{freeze}");
            if (J.Str(r, "status").Equals("pending", StringComparison.OrdinalIgnoreCase))
                await admin.Post($"/api/membership-requests/{freeze}/approve", new { note = "[Demo] Approved — enjoy the trip." });
        });
        var m2 = await As("member2");
        await Ensure("membershipRequest.cancel.member2", "MembershipRequest", async () => J.Id(await m2.Post("/api/me/membership-requests", new
        { type = "cancel", membershipId = m.Id("membership.member2"), reason = "[Demo] Moving to another city" })));
    }

    private async Task ShopAsync()
    {
        var admin = await As("admin");
        var cat = await Ensure("shop.category", "ShopCategory", async () => J.Id(await admin.Post("/api/shop/admin/categories", new
        { name = "[Demo] Gym Gear", slug = "demo-gym-gear", description = "[Demo] Demo products — not for sale.", sortOrder = 99, isActive = true })));
        var products = new (string Key, string Name, string Sku, double Price, (string Name, string? Size, string? Colour, string? Flavour, double Price, int Stock)[] Variants)[]
        {
            ("shaker", "[Demo] Shaker Bottle", "DEMO-SHK", 499, [("500 ml", "500 ml", null, null, 499, 40), ("700 ml", "700 ml", null, null, 599, 25)]),
            ("band", "[Demo] Resistance Band", "DEMO-BND", 799, [("Light", null, "Green", null, 799, 30), ("Heavy", null, "Black", null, 899, 15)]),
            ("whey", "[Demo] Whey Protein Sample", "DEMO-WHY", 149, [("Chocolate", "30 g", null, "Chocolate", 149, 60), ("Vanilla", "30 g", null, "Vanilla", 149, 4)]),
        };
        foreach (var p in products)
        {
            var pid = await Ensure($"shop.product.{p.Key}", "ShopProduct", async () => J.Id(await admin.Post("/api/shop/admin/products", new
            {
                name = p.Name, slug = "demo-" + p.Key, sku = p.Sku, shortDescription = "[Demo] demo product", description = "[Demo] Demo product for QA. Not for sale.",
                brand = "Demo Brand", basePrice = p.Price, categoryId = cat, isActive = true, isFeatured = false, isNew = true,
            })));
            for (var i = 0; i < p.Variants.Length; i++)
            {
                var v = p.Variants[i];
                var sku = $"{p.Sku}-{i + 1}";
                var key = $"shop.variant.{p.Key}.{i}";
                // The variants endpoint answers with the product, so the variant id is read back by SKU.
                if (m.Get(key) is null || m.Steps.GetValueOrDefault("#verified." + key) != "done")
                {
                    var existing = await VariantIdAsync(pid, sku);
                    if (existing is null)
                    {
                        await admin.Post($"/api/shop/admin/products/{pid}/variants", new
                        {
                            sku, name = v.Name, size = v.Size, colour = v.Colour, flavour = v.Flavour, price = v.Price,
                            isDefault = i == 0, isActive = true, initialStock = v.Stock, lowStockThreshold = 5,
                        });
                        existing = await VariantIdAsync(pid, sku) ?? throw new InvalidOperationException($"Variant {sku} not found after create.");
                    }
                    m.Put(key, "ShopVariant", existing.Value);
                    m.Steps["#verified." + key] = "done";
                    m.Save();
                }
            }
        }
        await Ensure("shop.coupon", "Coupon", async () => J.Id(await admin.Post("/api/shop/admin/coupons", new
        {
            code = "DEMOSHOP10", description = "[Demo] 10% off demo gear", discountType = 0, value = 10, minOrderAmount = 0,
            startsAt = DateTime.UtcNow.AddMinutes(-5), endsAt = DateTime.UtcNow.AddDays(30), usageLimit = 10, isActive = true,
        })));

        // member1 orders cash-on-delivery; the shop moves it to Shipped.
        var m1 = await As("member1");
        var addr = await Ensure("shop.address.member1", "ShopAddress", async () => J.Id(await m1.Post("/api/shop/addresses", new
        {
            label = "Home", fullName = "Priya Sharma (Demo)", phone = "+919000000201", line1 = "[Demo] 1 Demo Street", line2 = "Demo Nagar",
            city = "Bengaluru", state = "Karnataka", postalCode = "560001", country = "India", isDefault = true,
        })));
        string? orderNumber = m.Steps.GetValueOrDefault("#shop.orderNumber")?.Replace("value:", "");
        if (orderNumber is null)
        {
            await m1.Post("/api/shop/cart/items", new { variantId = m.Id("shop.variant.shaker.0"), quantity = 1 });
            await m1.Post("/api/shop/cart/items", new { variantId = m.Id("shop.variant.band.1"), quantity = 2 });
            var order = await m1.Post("/api/shop/orders", new { addressId = addr, deliveryMethod = 0, paymentMethod = 0, couponCode = "DEMOSHOP10", notes = "[Demo] order" });
            orderNumber = J.Str(order, "orderNumber");
            m.Put("shop.order.member1", "ShopOrder", J.Id(order));
            m.Steps["#shop.orderNumber"] = "value:" + orderNumber;
            m.Save();
        }
        foreach (var status in new[] { 1, 2, 3 })
            await Once($"shop.order.status.{status}", () => admin.Patch($"/api/shop/admin/orders/{orderNumber}/status", new { status, trackingNumber = status == 3 ? "DEMO-TRACK-0001" : null }));
    }

    private async Task<ulong?> VariantIdAsync(ulong productId, string sku)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ShopVariants.Where(x => x.ProductId == productId && x.Sku == sku).Select(x => (ulong?)x.Id).FirstOrDefaultAsync();
    }

    private async Task SocialAsync()
    {
        async Task<ulong> Post(string member, string caption)
        {
            var api = await As(member);
            using var form = new MultipartFormDataContent { { new StringContent(caption), "caption" } };
            using var req = new HttpRequestMessage(HttpMethod.Post, "/api/social/posts") { Content = form };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", api.Token);
            using var res = await http.SendAsync(req);
            var text = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new ApiException("POST", "/api/social/posts", (int)res.StatusCode, text);
            return J.Id(JsonNode.Parse(text)?["data"]);
        }
        var p1 = await Ensure("social.post.member1", "SocialPost", () => Post("member1", "[Demo] First full week of the 4-week plan done! Goblet squats up to 18 kg."));
        var p2 = await Ensure("social.post.member2", "SocialPost", () => Post("member2", "[Demo] Sunset yoga was exactly what I needed today."));
        await Ensure("social.comment.member3", "SocialPostComment", async () => J.Id(await (await As("member3")).Post($"/api/social/posts/{p1}/comments", new { text = "[Demo] Amazing progress, Priya!" })));
        await Ensure("social.comment.member1", "SocialPostComment", async () => J.Id(await (await As("member1")).Post($"/api/social/posts/{p2}/comments", new { text = "[Demo] See you at the next one!" })));
        await Try("social.like.member2", async () => await (await As("member2")).Post($"/api/social/posts/{p1}/like", new { }));
        await Try("social.like.member4", async () => await (await As("member4")).Post($"/api/social/posts/{p1}/like", new { }));
    }

    private async Task ChallengesAsync()
    {
        var admin = await As("admin");
        var id = await Ensure("challenge.demo", "Challenge", async () => J.Id(await admin.Post("/api/challenges", new
        {
            title = "[Demo] November Workout Streak", description = "[Demo] Log 12 workouts before the month ends.",
            targetValue = 12, startsAt = DateTime.UtcNow.AddDays(-1), endsAt = DateTime.UtcNow.AddDays(17), prizeLabel = "[Demo] Free shaker bottle",
        })));
        foreach (var (mem, val) in new[] { ("member1", 5.0), ("member2", 3.0), ("member3", 1.0) })
        {
            var api = await As(mem);
            await Try($"challenge.join.{mem}", () => api.Post($"/api/challenges/{id}/join", new { }));
            await Try($"challenge.progress.{mem}", () => api.Post($"/api/challenges/{id}/progress", new { value = val, set = true }));
        }
    }

    private async Task LeadsAsync()
    {
        var admin = await As("admin");
        var l1 = await Ensure("lead.1", "Lead", async () => J.Id(await admin.Post("/api/leads", new
        { branchId, firstName = "Demo", lastName = "Lead Rohan (Demo)", email = "demo.lead.rohan" + D, phone = "+919000000301", source = "walk-in", notes = "[Demo] Interested in the annual plan." })));
        await Ensure("lead.2", "Lead", async () => J.Id(await admin.Post("/api/leads", new
        { branchId, firstName = "Demo", lastName = "Lead Sneha (Demo)", email = "demo.lead.sneha" + D, phone = "+919000000302", source = "instagram", notes = "[Demo] Asked about yoga timings." })));
        await Try("lead.1.followup", () => admin.Post($"/api/leads/{l1}/followup", new { description = "[Demo] Called, booked a trial for Saturday.", outcome = "trial booked", activityType = "call" }));
    }

    private async Task CorporateAsync()
    {
        var admin = await As("admin");
        var id = await Ensure("corporate.acme", "CorporateAccount", async () => J.Id(await admin.Post("/api/corporate/accounts", new
        { name = "[Demo] Acme Wellness Corp", contactEmail = "hr.acme" + D, contactPhone = "+919000000401", maxMembers = 10 })));
        await Try("corporate.member4", () => admin.Post($"/api/corporate/accounts/{id}/members", new { userId = U("member4"), planId = m.Id("plan.monthly"), startsAt = Ymd(TodayIst) }));
    }

    private async Task PrivacyAsync()
    {
        var m2 = await As("member2");
        await Ensure("privacy.export.member2", "DataExportRequest", async () => J.Id(await m2.Post("/api/me/data-export", new { })));
    }

    /// <summary>Marks the just-finished demo class: two attended, one no-show.</summary>
    private async Task PastAttendanceAsync()
    {
        var admin = await As("admin");
        var t1 = await As("trainer1");
        var cls = await admin.Get($"/api/classes/{m.Id("class.past")}");
        var startsAt = DateTime.Parse(J.Str(cls, "startsAt")).ToUniversalTime();
        var wait = startsAt - DateTime.UtcNow + TimeSpan.FromSeconds(5);
        if (wait > TimeSpan.Zero)
        {
            Console.WriteLine($"  waiting {wait.TotalSeconds:0}s for the class to start…");
            await Task.Delay(wait);
        }
        foreach (var (mem, attended) in new[] { ("member1", true), ("member2", true), ("member3", false) })
            await Try($"attend.past.{mem}", () => t1.Put($"/api/classes/{m.Id("class.past")}/attendance", new { clientId = U(mem), attended }));
    }

    private async Task TwoFactorAsync()
    {
        var key = "member4";
        var acct = creds.Accounts[key];
        if (acct.TotpSecret is not null && m.Steps.GetValueOrDefault("#2fa.enabled") == "done") return;
        var api = await As(key);
        var setup = await api.Post("/api/auth/2fa/setup", new { });
        acct.TotpSecret = J.Str(setup, "secret");
        creds.Save();
        var code = Totp.Compute(Totp.FromBase32(acct.TotpSecret), Totp.TimeStep(DateTimeOffset.UtcNow));
        var res = await api.Post("/api/auth/2fa/enable", new { code });
        acct.RecoveryCodes = J.Items(res?["codes"] ?? res?["recoveryCodes"]).Select(c => c.ToString()).ToList();
        creds.Save();
        m.Steps["#2fa.enabled"] = "done";
        Note("2FA (authenticator app) enabled for member4; the TOTP secret and recovery codes are in the credentials file only.");
    }
}
