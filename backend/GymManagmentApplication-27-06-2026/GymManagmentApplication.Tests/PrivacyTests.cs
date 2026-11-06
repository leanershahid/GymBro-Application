using System.IO.Compression;
using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.TwoFactor;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Privacy;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Entities.Social;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using GymManagmentApplication.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>Delete my account, download my data (roadmap feature 2).</summary>
public class PrivacyTests : IDisposable
{
    private const string Password = "Passw0rd!";
    private const ulong Admin = 1, Member = 100, OtherMember = 101, OtherGymMember = 200;
    private readonly TestDb _db = new();
    private readonly FakeStorage _storage = new();
    private readonly ISecretProtector _secrets = new SecretProtector(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Secrets:Key"] = "test-key" }).Build());
    private static readonly PrivacyRequestMeta Meta = new("10.0.0.1", "test-agent");

    public PrivacyTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        using (var db = _db.Create(null))
        {
            db.Roles.Add(new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" });
            db.SaveChanges();
        }
        AddUser(Admin, 1, 12);
        AddUser(Member, 1, 11, avatar: "https://cdn/avatar-100.jpg");
        AddUser(OtherMember, 1, 11);
        AddUser(OtherGymMember, 2, 21);
    }

    public void Dispose() => _db.Dispose();

    private void AddUser(ulong id, ulong tenantId, ulong roleId, string? avatar = null)
    {
        using var db = _db.Create(null);
        db.Users.Add(new User
        {
            Id = id, TenantId = tenantId, RoleId = roleId, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
            FirstName = "Person", LastName = $"N{id}", Phone = $"+91 98765 0{id}", Dob = new DateOnly(1990, 1, 1), AvatarUrl = avatar,
            PasswordHash = PasswordHasher.Hash(Password), Status = UserStatus.Active,
        });
        db.SaveChanges();
    }

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsAdmin() => new() { UserId = Admin, Role = "admin", TenantId = 1 };

    private PrivacyProcessor Processor(AppDbContext db, ICurrentUser? user = null) =>
        new(db, _storage, new EmailOutbox(db), new Notifier(db, user ?? new FakeUser { UserId = null, IsAuthenticated = false }), NullLogger<PrivacyProcessor>.Instance);

    private (AppDbContext Db, PrivacyService Svc) Service(FakeUser user)
    {
        var db = _db.Create(user);
        var twoFactor = new TwoFactorService(db, _secrets, NullLogger<TwoFactorService>.Instance);
        return (db, new PrivacyService(db, user, twoFactor, new EmailOutbox(db), _storage, Processor(db, user)));
    }

    private async Task<DeletionRequestResponse> RequestDeletionAsync(ulong member = Member, string password = Password)
    {
        var (db, svc) = Service(AsMember(member));
        using (db) return await svc.RequestMyDeletionAsync(new RequestDeletionBody { Password = password, Confirm = true }, Meta);
    }

    private async Task<int> RunJobAsync(DateTime at, ulong tenantId = 1)
    {
        using var db = _db.Create(null);
        return await Processor(db).RunDueDeletionsAsync(tenantId, at);
    }

    private void AddInvoice(ulong userId, ulong tenantId, InvoiceStatus status, decimal total, decimal paid, string no)
    {
        using var db = _db.Create(null);
        var invoice = new Invoice { TenantId = tenantId, UserId = userId, InvoiceNo = no, Status = status, Subtotal = total, Total = total, AmountPaid = paid, Currency = "INR" };
        db.Invoices.Add(invoice);
        db.SaveChanges();
        if (paid > 0)
        {
            db.Payments.Add(new Payment { TenantId = tenantId, InvoiceId = invoice.Id, Amount = paid, Currency = "INR", Method = PaymentMethod.Upi, Status = PaymentStatus.Completed });
            db.SaveChanges();
        }
    }

    // ── Delete my account ───────────────────────────────────────────────────

    [Fact]
    public async Task Deletion_is_blocked_while_money_is_owed()
    {
        AddInvoice(Member, 1, InvoiceStatus.Overdue, 1500, 500, "INV-1");

        var ex = await Assert.ThrowsAsync<RuleException>(() => RequestDeletionAsync());
        Assert.Equal("DELETION_BLOCKED", ex.Code);
        Assert.Contains("unpaid invoice", ex.Message);
        var check = Assert.IsType<DeletionCheckResponse>(ex.Payload);
        Assert.Contains(check.Blockers, b => b.Code == "open_invoices" && b.Route == "billing" && b.Action != null);

        using var db = _db.Create(null);
        var row = Assert.Single(db.AccountDeletionRequests.Where(r => r.UserId == Member));
        Assert.Equal(DeletionStatuses.Blocked, row.Status);
        Assert.Equal(UserStatus.Active, db.Users.Single(u => u.Id == Member).Status);
    }

    [Fact]
    public async Task Deletion_is_blocked_by_an_order_in_progress()
    {
        AddOrder(Member, 1, ShopOrderStatus.Shipped, "ORD-1");
        var ex = await Assert.ThrowsAsync<RuleException>(() => RequestDeletionAsync());
        Assert.Contains(Assert.IsType<DeletionCheckResponse>(ex.Payload).Blockers, b => b.Code == "order_in_progress");
    }

    [Fact]
    public async Task Wrong_password_is_refused()
    {
        var ex = await Assert.ThrowsAsync<RuleException>(() => RequestDeletionAsync(password: "nope"));
        Assert.Equal("REAUTH_FAILED", ex.Code);
        using var db = _db.Create(null);
        Assert.False(db.AccountDeletionRequests.Any());
    }

    [Fact]
    public async Task Request_revokes_sessions_and_waits_for_the_grace_period_then_keep_my_account_cancels()
    {
        using (var db = _db.Create(null))
        {
            db.UserSessions.Add(new UserSession { UserId = Member, TokenHash = "h1", ExpiresAt = DateTime.UtcNow.AddDays(30) });
            db.SaveChanges();
        }
        var before = DateTime.UtcNow;
        var request = await RequestDeletionAsync();

        Assert.Equal(DeletionStatuses.Pending, request.Status);
        Assert.InRange(request.ScheduledFor, before.AddDays(14).AddMinutes(-1), DateTime.UtcNow.AddDays(14).AddMinutes(1));
        using (var db = _db.Create(null))
        {
            Assert.False(db.UserSessions.Any(s => s.UserId == Member));
            Assert.True(db.Users.Single(u => u.Id == Member).TokenVersion > 0);
            Assert.True(db.CommunicationLogs.Any(l => l.UserId == Member && l.Subject.Contains("will be deleted")));
        }

        // Inside the grace period nothing happens.
        Assert.Equal(0, await RunJobAsync(DateTime.UtcNow.AddDays(13)));

        // The member signs in again and keeps the account.
        var (sdb, svc) = Service(AsMember());
        using (sdb)
        {
            Assert.NotNull(await svc.GetMyDeletionAsync());
            var kept = await svc.CancelMyDeletionAsync();
            Assert.Equal(DeletionStatuses.Cancelled, kept!.Status);
            Assert.Null(await svc.GetMyDeletionAsync());
        }
        Assert.Equal(0, await RunJobAsync(DateTime.UtcNow.AddDays(20)));
        using var check = _db.Create(null);
        Assert.Equal("Person", check.Users.Single(u => u.Id == Member).FirstName);
    }

    [Fact]
    public async Task Grace_period_follows_the_gym_setting()
    {
        var (adb, admin) = Service(AsAdmin());
        using (adb)
        {
            await Assert.ThrowsAsync<ArgumentException>(() => admin.SaveSettingsAsync(new PrivacySettings { GraceDays = 3 }));
            await admin.SaveSettingsAsync(new PrivacySettings { GraceDays = 7, PrivacyPolicyUrl = "https://gym.example/privacy" });
        }
        var request = await RequestDeletionAsync();
        Assert.InRange((request.ScheduledFor - request.RequestedAt).TotalDays, 6.99, 7.01);
    }

    [Fact]
    public async Task Anonymisation_keeps_financial_records_and_removes_personal_data()
    {
        SeedEverything(Member);
        SeedEverything(OtherMember);
        await RequestDeletionAsync();

        Assert.Equal(1, await RunJobAsync(DateTime.UtcNow.AddDays(15)));

        using var db = _db.Create(null);
        var user = db.Users.Single(u => u.Id == Member);
        Assert.Equal("Deleted member", $"{user.FirstName} {user.LastName}");
        Assert.Equal($"deleted+{Member}@invalid", user.Email);
        Assert.Null(user.Phone);
        Assert.Null(user.Dob);
        Assert.Null(user.AvatarUrl);
        Assert.Null(user.PasswordHash);
        Assert.NotNull(user.DeletedAt);
        Assert.Contains("https://cdn/avatar-100.jpg", _storage.Deleted);

        // Kept: invoices, payments, orders — amounts intact.
        var invoice = db.Invoices.Single(i => i.UserId == Member);
        Assert.Equal(999m, invoice.Total);
        Assert.Single(db.Payments.Where(p => p.InvoiceId == invoice.Id && p.Amount == 999m));
        var order = db.ShopOrders.Single(o => o.UserId == Member);
        Assert.Equal(450m, order.Total);
        Assert.Equal("Deleted member", order.ShippingAddress.FullName);
        Assert.Equal("", order.ShippingAddress.Phone);
        Assert.Equal("Redacted", order.ShippingAddress.Line1);

        // Removed / redacted.
        var profile = db.ClientProfiles.Single(p => p.UserId == Member);
        Assert.Null(profile.HealthConditions);
        Assert.Null(profile.EmergencyContact);
        Assert.Null(profile.WeightKg);
        Assert.False(db.MemberEmergencyContacts.Any(c => c.UserId == Member));
        Assert.False(db.HealthScreenings.Any(h => h.UserId == Member));
        var signature = db.WaiverSignatures.Single(s => s.UserId == Member);
        Assert.Equal("Deleted member", signature.SignedName);
        Assert.Null(signature.Ip);
        Assert.Null(signature.UserAgent);
        Assert.Equal(1, signature.VersionNumber); // legal record kept
        Assert.Null(db.ConsentRecords.Single(c => c.UserId == Member).Ip);
        Assert.False(db.PushDevices.Any(d => d.UserId == Member));
        Assert.False(db.NotificationPreferences.Any(d => d.UserId == Member));
        Assert.False(db.UserSessions.Any(s => s.UserId == Member));
        Assert.False(db.ShopAddresses.IgnoreQueryFilters().Any(a => a.UserId == Member));
        Assert.False(db.ShopCarts.Any(c => c.UserId == Member));
        Assert.False(db.ShopWishlists.Any(w => w.UserId == Member));
        // Social: anonymised by default (rows stay, author is the anonymised user).
        Assert.Single(db.SocialPosts.Where(p => p.UserId == Member && !p.IsDeleted));

        // Audit: who / when / which tables, no personal data.
        var request = db.AccountDeletionRequests.Single(r => r.UserId == Member);
        Assert.Equal(DeletionStatuses.Completed, request.Status);
        var audit = db.AuditLogs.Single(a => a.Action == "privacy.account_anonymised" && a.EntityId == Member);
        var auditText = audit.NewValues!.RootElement.GetRawText();
        Assert.Contains("WaiverSignatures", auditText);
        Assert.DoesNotContain("u100@test.local", auditText);
        Assert.DoesNotContain("N100", auditText);
        // Completion email queued to the real address.
        Assert.True(db.CommunicationLogs.Any(l => l.Recipient == "u100@test.local" && l.Subject.Contains("has been deleted")));

        // The other member is untouched.
        var other = db.Users.Single(u => u.Id == OtherMember);
        Assert.Equal("Person", other.FirstName);
        Assert.Equal("Person N101", db.WaiverSignatures.Single(s => s.UserId == OtherMember).SignedName);
        Assert.True(db.HealthScreenings.Any(h => h.UserId == OtherMember));
        Assert.True(db.PushDevices.Any(d => d.UserId == OtherMember));
        Assert.Equal("Person N101", db.ShopOrders.Single(o => o.UserId == OtherMember).ShippingAddress.FullName);
    }

    [Fact]
    public async Task Social_content_is_deleted_when_the_gym_chooses_delete()
    {
        SeedEverything(Member);
        var (adb, admin) = Service(AsAdmin());
        using (adb) await admin.SaveSettingsAsync(new PrivacySettings { GraceDays = 14, SocialContentOnDeletion = "delete" });
        await RequestDeletionAsync();
        await RunJobAsync(DateTime.UtcNow.AddDays(15));

        using var db = _db.Create(null);
        Assert.All(db.SocialPosts.Where(p => p.UserId == Member), p => Assert.True(p.IsDeleted));
        Assert.All(db.SocialPostComments.Where(c => c.UserId == Member), c => Assert.True(c.IsDeleted));
        Assert.Contains("https://cdn/post-100.jpg", _storage.Deleted);
    }

    [Fact]
    public async Task Debt_appearing_during_the_grace_period_blocks_the_job()
    {
        await RequestDeletionAsync();
        AddInvoice(Member, 1, InvoiceStatus.Sent, 700, 0, "INV-LATE");
        Assert.Equal(0, await RunJobAsync(DateTime.UtcNow.AddDays(15)));

        using var db = _db.Create(null);
        var r = db.AccountDeletionRequests.Single(x => x.UserId == Member);
        Assert.Equal(DeletionStatuses.Blocked, r.Status);
        Assert.Contains("unpaid invoice", r.BlockedReason);
        Assert.Equal("Person", db.Users.Single(u => u.Id == Member).FirstName);
    }

    [Fact]
    public async Task Admin_can_delete_a_member_now_and_it_is_audited()
    {
        var (db, svc) = Service(AsAdmin());
        using (db)
        {
            await Assert.ThrowsAsync<ArgumentException>(() => svc.RequestForMemberAsync(Member, new StaffDeletionBody()));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.RequestForMemberAsync(OtherGymMember, new StaffDeletionBody { Reason = "Asked at desk" }));
            await svc.RequestForMemberAsync(Member, new StaffDeletionBody { Reason = "Asked at desk", ProcessNow = true });
            var list = await svc.GetRequestsAsync(null);
            var row = Assert.Single(list.Deletions);
            Assert.Equal(DeletionStatuses.Completed, row.Status);
            Assert.Equal("staff", row.Source);
        }
        using var check = _db.Create(null);
        Assert.Equal($"deleted+{Member}@invalid", check.Users.Single(u => u.Id == Member).Email);
        Assert.True(check.AuditLogs.Any(a => a.Action == "privacy.deletion_requested" && a.UserId == Admin));
        Assert.True(check.AuditLogs.Any(a => a.Action == "privacy.account_anonymised" && a.UserId == Admin));
    }

    // ── Download my data ────────────────────────────────────────────────────

    [Fact]
    public async Task Export_contains_every_section_and_only_this_members_data()
    {
        SeedEverything(Member);
        SeedEverything(OtherMember);
        using (var seed = _db.Create(null))
        {
            seed.Invoices.Add(new Invoice { TenantId = 2, UserId = OtherGymMember, InvoiceNo = "G2-1", Total = 5, Currency = "INR" });
            seed.SaveChanges();
        }

        using var db = _db.Create(null);
        var zip = await Processor(db).BuildExportZipAsync(1, Member, DateTime.UtcNow);
        using var archive = new ZipArchive(new MemoryStream(zip));
        Assert.NotNull(archive.GetEntry("summary.html"));
        using var json = JsonDocument.Parse(archive.GetEntry("data.json")!.Open());
        var sections = json.RootElement.GetProperty("sections");
        foreach (var name in PrivacyProcessor.ExportSections) Assert.True(sections.TryGetProperty(name, out _), $"missing section {name}");

        Assert.Equal("u100@test.local", sections.GetProperty("profile").GetProperty("email").GetString());
        Assert.Equal(1, sections.GetProperty("invoices").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("payments").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("healthScreenings").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("waiverSignatures").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("consents").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("shopOrders").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("socialPosts").GetArrayLength());
        var raw = json.RootElement.GetRawText();
        Assert.DoesNotContain("u101@test.local", raw);
        Assert.DoesNotContain("N101", raw);
        Assert.DoesNotContain("G2-1", raw);
        Assert.DoesNotContain("pbkdf2", raw); // no password hash
    }

    [Fact]
    public async Task Export_is_rate_limited_to_one_a_day()
    {
        var (db, svc) = Service(AsMember());
        using (db)
        {
            var first = await svc.RequestMyExportAsync();
            Assert.Equal(ExportStatuses.Preparing, first.Status);
            var ex = await Assert.ThrowsAsync<RuleException>(() => svc.RequestMyExportAsync());
            Assert.Equal(429, ex.StatusCode);
            Assert.Equal("EXPORT_RATE_LIMITED", ex.Code);
            Assert.NotNull((await svc.GetOverviewAsync()).NextExportAt);
        }
        // Another member is not affected.
        var (db2, svc2) = Service(AsMember(OtherMember));
        using (db2) await svc2.RequestMyExportAsync();
    }

    [Fact]
    public async Task Export_becomes_ready_privately_and_its_link_expires_after_seven_days()
    {
        ulong id;
        var (db, svc) = Service(AsMember());
        using (db) id = (await svc.RequestMyExportAsync()).Id;

        using (var job = _db.Create(null)) Assert.Equal(1, await Processor(job).ProcessQueuedExportsAsync(DateTime.UtcNow));
        Assert.Equal(FileKind.Archive, _storage.SavedKinds.Single());

        // Someone else can't fetch the link.
        var (odb, other) = Service(AsMember(OtherMember));
        using (odb) await Assert.ThrowsAsync<KeyNotFoundException>(() => other.GetMyExportLinkAsync(id));

        var (db2, svc2) = Service(AsMember());
        using (db2)
        {
            var link = await svc2.GetMyExportLinkAsync(id);
            Assert.EndsWith("?signed=1", link.Url);
            Assert.InRange(link.ExpiresAt, DateTime.UtcNow.AddDays(6.9), DateTime.UtcNow.AddDays(7.1));
        }
        using (var check = _db.Create(null))
            Assert.True(check.Notifications.Any(n => n.UserId == Member && n.Title.Contains("ready")));

        using (var job = _db.Create(null)) Assert.Equal(1, await Processor(job).ExpireExportsAsync(DateTime.UtcNow.AddDays(8)));
        Assert.Single(_storage.Deleted);
        var (db3, svc3) = Service(AsMember());
        using (db3)
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => svc3.GetMyExportLinkAsync(id));
            Assert.Equal(410, ex.StatusCode);
            Assert.Equal(ExportStatuses.Expired, (await svc3.GetMyExportsAsync()).Single().Status);
        }
    }

    // ── Seed helpers ────────────────────────────────────────────────────────

    private void AddOrder(ulong userId, ulong tenantId, ShopOrderStatus status, string number)
    {
        using var db = _db.Create(null);
        db.ShopOrders.Add(new ShopOrder
        {
            TenantId = tenantId, UserId = userId, OrderNumber = number, Status = status, Subtotal = 450, Total = 450, PlacedAt = DateTime.UtcNow,
            ShippingAddress = new ShopShippingAddress { FullName = $"Person N{userId}", Phone = "999", Line1 = "1 Main St", City = "Pune", State = "MH", PostalCode = "411001", Country = "India" },
        });
        db.SaveChanges();
    }

    private void SeedEverything(ulong userId)
    {
        AddInvoice(userId, 1, InvoiceStatus.Paid, 999, 999, $"INV-{userId}");
        AddOrder(userId, 1, ShopOrderStatus.Delivered, $"ORD-{userId}");
        using var db = _db.Create(null);
        if (!db.WaiverDocuments.Any())
        {
            var doc = new WaiverDocument { TenantId = 1, Title = "Liability" };
            db.WaiverDocuments.Add(doc);
            db.SaveChanges();
            db.WaiverVersions.Add(new WaiverVersion { TenantId = 1, WaiverId = doc.Id, Version = 1, Title = "Liability", Body = "text", BodyHash = "hash" });
            db.SaveChanges();
        }
        var version = db.WaiverVersions.First();
        db.WaiverSignatures.Add(new WaiverSignature
        {
            TenantId = 1, UserId = userId, WaiverId = version.WaiverId, WaiverVersionId = version.Id, VersionNumber = 1,
            SignedName = $"Person N{userId}", Ip = "1.2.3.4", UserAgent = "phone", BodyHash = "hash",
        });
        db.ClientProfiles.Add(new ClientProfile
        {
            TenantId = 1, UserId = userId, WeightKg = 80,
            HealthConditions = JsonDocument.Parse("[\"asthma\"]"), EmergencyContact = JsonDocument.Parse("{\"name\":\"Mum\",\"phone\":\"+91 1\"}"),
        });
        db.MemberEmergencyContacts.Add(new MemberEmergencyContact { TenantId = 1, UserId = userId, Name = "Mum", Phone = "+91 98765 43210" });
        db.HealthScreenings.Add(new HealthScreening { TenantId = 1, UserId = userId, FormVersion = "v1", Answers = JsonDocument.Parse("[]"), Conditions = "asthma", ExpiresAt = DateTime.UtcNow.AddYears(1) });
        db.ConsentRecords.Add(new ConsentRecord { TenantId = 1, UserId = userId, Type = ConsentTypes.HealthData, Granted = true, Ip = "1.2.3.4" });
        db.PushDevices.Add(new PushDevice { TenantId = 1, UserId = userId, Token = $"ExponentPushToken[{userId}]" });
        db.NotificationPreferences.Add(new NotificationPreference { TenantId = 1, UserId = userId });
        db.UserSessions.Add(new UserSession { UserId = userId, TokenHash = $"s{userId}", ExpiresAt = DateTime.UtcNow.AddDays(30) });
        db.ShopAddresses.Add(new ShopAddress { TenantId = 1, UserId = userId, FullName = $"Person N{userId}", Phone = "999", Line1 = "1 Main St", City = "Pune", State = "MH", PostalCode = "411001" });
        db.ShopCarts.Add(new ShopCart { TenantId = 1, UserId = userId });
        db.ShopWishlists.Add(new ShopWishlist { TenantId = 1, UserId = userId });
        var post = new SocialPost { TenantId = 1, UserId = userId, Caption = "Leg day" };
        db.SocialPosts.Add(post);
        db.SaveChanges();
        db.SocialPostImages.Add(new SocialPostImage { PostId = post.Id, ImageUrl = $"https://cdn/post-{userId}.jpg" });
        db.SocialPostComments.Add(new SocialPostComment { PostId = post.Id, UserId = userId, CommentText = "Nice" });
        db.SaveChanges();
    }

    private sealed class FakeStorage : IFileStorage
    {
        public readonly List<FileKind> SavedKinds = [];
        public readonly List<string> Deleted = [];
        public Task<string> SaveAsync(FileUpload file, string folder, FileKind kind)
        {
            SavedKinds.Add(kind);
            return Task.FromResult($"https://store/authenticated/{folder}/{Guid.NewGuid():N}.zip");
        }
        public Task DeleteAsync(string? url) { if (url is not null) Deleted.Add(url); return Task.CompletedTask; }
        public Task<string> GetSignedUrlAsync(string url) => Task.FromResult(url + "?signed=1");
    }
}
