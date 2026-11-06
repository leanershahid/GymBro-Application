using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Attendance;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GymManagmentApplication.Tests;

/// <summary>Waivers, health screening, gating and the health visibility rule (roadmap feature 1).</summary>
public class SafetyTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly ulong _classId;

    // People of gym 1: admin 1, assigned trainer 2, unassigned trainer 3, staff 5 (no health grant),
    // members 100 (Member 100) and 101.
    private const ulong Admin = 1, Trainer = 2, OtherTrainer = 3, Staff = 5, Member = 100, OtherMember = 101;

    public SafetyTests()
    {
        _db.SeedGym(1);
        using (var seed = _db.Create(null))
        {
            seed.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 13, TenantId = 1, Name = "Trainer", Slug = "trainer" },
                new Role { Id = 14, TenantId = 1, Name = "Staff", Slug = "staff" });
            seed.SaveChanges();
        }
        AddUser(Admin, 12, "Ada", "Admin");
        AddUser(Trainer, 13, "Tia", "Trainer");
        AddUser(OtherTrainer, 13, "Tom", "Trainer");
        AddUser(Staff, 14, "Sam", "Staff");
        _db.AddMember(Member, branchId: 11);
        _db.AddMember(OtherMember);

        using var db = _db.Create(null);
        var health = new Module { Key = "admin.members.health", App = "admin", Name = "Health answers", ApiModules = "health-screening", Level = 2 };
        db.Modules.Add(health);
        db.SaveChanges();
        db.RoleModuleGrants.Add(new RoleModuleGrant { TenantId = 1, RoleId = 12, ModuleId = health.Id, CanView = true, CanCreate = true, CanEdit = true });

        var tp = new TrainerProfile { TenantId = 1, UserId = Trainer, BranchId = 11, DisplayName = "Tia" };
        var tp2 = new TrainerProfile { TenantId = 1, UserId = OtherTrainer, BranchId = 11, DisplayName = "Tom" };
        db.TrainerProfiles.AddRange(tp, tp2);
        db.SaveChanges();
        db.TrainerClientAssignments.Add(new TrainerClientAssignment { TenantId = 1, TrainerId = tp.Id, ClientId = Member, BranchId = 11 });

        var gymClass = new GymClass
        {
            TenantId = 1, BranchId = 11, ClassType = new ClassType { TenantId = 1, Name = "Spin" }, Title = "Spin",
            StartsAt = DateTime.UtcNow.AddDays(1), EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1), MaxCapacity = 10,
        };
        db.GymClasses.Add(gymClass);
        db.SaveChanges();
        _classId = gymClass.Id;
    }

    private void AddUser(ulong id, ulong roleId, string first, string last)
    {
        using var db = _db.Create(null);
        db.Users.Add(new User
        {
            Id = id, TenantId = 1, RoleId = roleId, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
            FirstName = first, LastName = last, Status = Domain.Enums.UserStatus.Active,
        });
        db.SaveChanges();
    }

    private static FakeUser As(ulong id, string role) => new() { UserId = id, Role = role, TenantId = 1 };
    private static FakeUser AsMember(ulong id = Member) => As(id, "client");
    private static readonly RequestMeta Meta = new("127.0.0.1", "xunit");

    private (AppDbContext Db, SafetyService Svc, SafetyGate Gate) Services(FakeUser me)
    {
        var db = _db.Create(me);
        var gate = new SafetyGate(db, me);
        var access = new AccessService(db, me, new MemoryCache(new MemoryCacheOptions()));
        return (db, new SafetyService(db, me, gate, new Notifier(db, me), access), gate);
    }

    private async Task<AdminWaiverResponse> CreateWaiverAsync()
    {
        var (db, svc, _) = Services(As(Admin, "admin"));
        using (db) return await svc.CreateWaiverAsync(new CreateWaiverRequest { Title = "Liability waiver", Body = WaiverTemplate.Body });
    }

    private async Task SignLatestAsync(ulong member = Member)
    {
        var (db, svc, _) = Services(AsMember(member));
        using (db)
        {
            var pending = await svc.GetPendingWaiversAsync();
            foreach (var w in pending)
                await svc.SignWaiverAsync(w.VersionId, new SignWaiverRequest { SignedName = $"member {member}", Agreed = true }, Meta);
        }
    }

    private async Task<HealthScreeningResponse> SubmitHealthAsync(bool anyYes = false, ulong member = Member)
    {
        var (db, svc, _) = Services(AsMember(member));
        using (db)
            return await svc.SubmitHealthAsync(new SubmitHealthRequest
            {
                Answers = [anyYes, false, false, false, false, false, false], GrantHealthDataConsent = true,
            }, Meta);
    }

    private async Task BookAsMemberAsync()
    {
        var me = AsMember();
        using var db = _db.Create(me);
        await new ClassService(db, me, new Notifier(db, me), new SafetyGate(db, me)).BookAsync(_classId, new BookClassRequest());
    }

    private async Task<bool> CanBookAsync()
    {
        var (db, _, gate) = Services(AsMember());
        using (db) return (await gate.EvaluateAsync(Member)).CanBook;
    }

    // ── Gating ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Booking_is_blocked_with_SAFETY_REQUIRED_until_waiver_and_health_are_done()
    {
        await CreateWaiverAsync();
        await EnableGatingAsync();

        var ex = await Assert.ThrowsAsync<SafetyGateException>(BookAsMemberAsync);
        Assert.Equal(422, ex.StatusCode);
        Assert.Equal("SAFETY_REQUIRED", ex.Code);
        Assert.Contains("waiver", ex.Missing);
        Assert.Contains("health", ex.Missing);

        await SignLatestAsync();
        ex = await Assert.ThrowsAsync<SafetyGateException>(BookAsMemberAsync);
        Assert.Equal(["health"], ex.Missing);

        await SubmitHealthAsync();
        await BookAsMemberAsync(); // cleared

        using var check = _db.Create(null);
        Assert.Equal(1, await check.ClassBookings.CountAsync(b => b.ClientId == Member));
    }

    /// <summary>Gating is off by default (so a deploy doesn't lock members out); these tests switch it on.</summary>
    private async Task EnableGatingAsync()
    {
        var (db, svc, _) = Services(As(Admin, "admin"));
        using (db) await svc.UpdateSettingsAsync(new SafetySettings { GatingEnabled = true, HealthValidDays = 365 });
    }

    [Fact]
    public void Gating_is_off_by_default() => Assert.False(new SafetySettings().GatingEnabled);

    [Fact]
    public async Task Gating_can_be_turned_off_per_gym()
    {
        await CreateWaiverAsync();
        var (db, svc, _) = Services(As(Admin, "admin"));
        using (db) await svc.UpdateSettingsAsync(new SafetySettings { GatingEnabled = false, HealthValidDays = 365 });

        await BookAsMemberAsync();
    }

    [Fact]
    public async Task Needs_clearance_does_not_block_by_default_but_notifies_admin_and_assigned_trainer()
    {
        var screening = await SubmitHealthAsync(anyYes: true);
        Assert.True(screening.NeedsClearance);

        await BookAsMemberAsync(); // no waiver defined, health submitted → allowed

        using var db = _db.Create(null);
        var notified = await db.Set<Notification>().Where(n => n.Title == "Health check needs clearance").Select(n => n.UserId).ToListAsync();
        Assert.Contains(Admin, notified);
        Assert.Contains(Trainer, notified);
        Assert.DoesNotContain(OtherTrainer, notified);
        Assert.DoesNotContain(Staff, notified);
    }

    [Fact]
    public async Task Desk_check_in_warns_and_records_who_overrode()
    {
        await CreateWaiverAsync();
        await EnableGatingAsync();
        var admin = As(Admin, "admin");

        using (var db = _db.Create(admin))
        {
            var svc = new AttendanceService(db, admin, new SafetyGate(db, admin));
            var blocked = await svc.CheckInMemberAsync(Member);
            Assert.False(blocked.CheckedIn);
            Assert.True(blocked.SafetyBlocked);
            Assert.Contains("waiver", blocked.SafetyMissing!);

            var forced = await svc.CheckInMemberAsync(Member, overrideSafety: true, overrideReason: "Signed on paper");
            Assert.True(forced.CheckedIn);
        }

        using var check = _db.Create(null);
        var o = await check.SafetyGateOverrides.SingleAsync();
        Assert.Equal(Admin, o.OverriddenByUserId);
        Assert.Equal(Member, o.UserId);
        Assert.Equal("desk_checkin", o.Context);
        Assert.Contains("waiver", o.Missing);
        Assert.Equal("Signed on paper", o.Reason);
        Assert.NotNull(o.AttendanceId);
    }

    // ── Signatures ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Signatures_are_immutable()
    {
        await CreateWaiverAsync();
        await SignLatestAsync();

        using var db = _db.Create(null);
        var sig = await db.WaiverSignatures.SingleAsync();
        sig.SignedName = "Someone Else";
        Assert.Throws<InvalidOperationException>(() => db.SaveChanges());

        db.ChangeTracker.Clear();
        var again = await db.WaiverSignatures.SingleAsync();
        db.WaiverSignatures.Remove(again);
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task Signature_needs_the_checkbox_and_the_members_name()
    {
        var waiver = await CreateWaiverAsync();
        var (db, svc, _) = Services(AsMember());
        using (db)
        {
            var versionId = waiver.LatestVersionId!.Value;
            await Assert.ThrowsAsync<ArgumentException>(() =>
                svc.SignWaiverAsync(versionId, new SignWaiverRequest { SignedName = "Member 100", Agreed = false }, Meta));
            await Assert.ThrowsAsync<ArgumentException>(() =>
                svc.SignWaiverAsync(versionId, new SignWaiverRequest { SignedName = "Somebody Else", Agreed = true }, Meta));

            var signed = await svc.SignWaiverAsync(versionId, new SignWaiverRequest { SignedName = "  member   100 ", Agreed = true }, Meta);
            Assert.Equal("member 100", signed.SignedName);
            Assert.Equal("127.0.0.1", signed.Ip);
            Assert.Equal("xunit", signed.UserAgent);
            Assert.Equal(64, signed.BodyHash.Length);

            // Signing the same version twice returns the first signature.
            var twice = await svc.SignWaiverAsync(versionId, new SignWaiverRequest { SignedName = "Member 100", Agreed = true }, Meta);
            Assert.Equal(signed.Id, twice.Id);
        }
    }

    // ── Versioning ──────────────────────────────────────────────────────────

    [Fact]
    public async Task New_version_requiring_resign_invalidates_old_signatures_but_minor_versions_do_not()
    {
        var waiver = await CreateWaiverAsync();
        await SignLatestAsync();

        // v2: wording fix, no re-sign → the v1 signature still counts.
        var (db, admin, _) = Services(As(Admin, "admin"));
        using (db) await admin.PublishVersionAsync(waiver.Id, new PublishWaiverVersionRequest { Body = WaiverTemplate.Body + "\n\nTypo fixed.", RequiresResign = false });
        var (db2, member, gate) = Services(AsMember());
        using (db2)
        {
            var status = (await gate.EvaluateAsync(Member)).Waivers.Single();
            Assert.Equal("signed", status.Status);
            Assert.Equal(1, status.SignedVersion);
            Assert.Equal(2, status.LatestVersion);
            Assert.Empty(await member.GetPendingWaiversAsync());
        }

        // v3: material change → must re-sign.
        var (db3, admin3, _) = Services(As(Admin, "admin"));
        using (db3) await admin3.PublishVersionAsync(waiver.Id, new PublishWaiverVersionRequest { Body = WaiverTemplate.Body + "\n\nNew clause.", RequiresResign = true });
        var (db4, member4, gate4) = Services(AsMember());
        using (db4)
        {
            var c = await gate4.EvaluateAsync(Member);
            Assert.Equal("resign_required", c.Waivers.Single().Status);
            Assert.Contains("waiver", c.Missing);
            var pending = Assert.Single(await member4.GetPendingWaiversAsync());
            Assert.Equal(3, pending.Version);
            Assert.Equal(1, pending.PreviouslySignedVersion);

            // An old version can't be signed any more.
            await Assert.ThrowsAsync<RuleException>(() => member4.SignWaiverAsync(waiver.LatestVersionId!.Value,
                new SignWaiverRequest { SignedName = "Member 100", Agreed = true }, Meta));
        }

        await SignLatestAsync();
        var (db5, _, gate5) = Services(AsMember());
        using (db5) Assert.Equal("signed", (await gate5.EvaluateAsync(Member)).Waivers.Single().Status);
    }

    [Fact]
    public async Task Versions_are_immutable_and_inactive_waivers_do_not_gate()
    {
        var waiver = await CreateWaiverAsync();
        using (var db = _db.Create(null))
        {
            var v = await db.WaiverVersions.SingleAsync();
            v.Body = "changed";
            Assert.Throws<InvalidOperationException>(() => db.SaveChanges());
        }

        var (db2, admin, _) = Services(As(Admin, "admin"));
        using (db2) await admin.UpdateWaiverAsync(waiver.Id, new UpdateWaiverRequest { IsActive = false });
        await SubmitHealthAsync();
        await BookAsMemberAsync(); // no active waiver left to sign
    }

    // ── Questionnaire ───────────────────────────────────────────────────────

    [Fact]
    public async Task Questionnaire_expires_after_the_configured_days()
    {
        var (db, admin, _) = Services(As(Admin, "admin"));
        using (db) await admin.UpdateSettingsAsync(new SafetySettings { GatingEnabled = true, HealthValidDays = 30 });

        var s = await SubmitHealthAsync();
        Assert.InRange((s.ExpiresAt - s.SubmittedAt).TotalDays, 29.99, 30.01);
        Assert.True(await CanBookAsync());

        // Age the submission past its expiry.
        using (var raw = _db.Create(null))
        {
            var row = await raw.HealthScreenings.SingleAsync();
            row.SubmittedAt = DateTime.UtcNow.AddDays(-31);
            row.ExpiresAt = DateTime.UtcNow.AddDays(-1);
            await raw.SaveChangesAsync();
        }

        var (db2, _, gate) = Services(AsMember());
        using (db2)
        {
            var c = await gate.EvaluateAsync(Member);
            Assert.Equal("expired", c.Health.Status);
            Assert.Contains("health_expired", c.Missing);
        }
        var ex = await Assert.ThrowsAsync<SafetyGateException>(BookAsMemberAsync);
        Assert.Contains("health_expired", ex.Missing);

        await SubmitHealthAsync(); // the yearly (here: monthly) re-take
        Assert.True(await CanBookAsync());
        await BookAsMemberAsync();
    }

    [Fact]
    public async Task Questionnaire_requires_health_data_consent()
    {
        var (db, svc, _) = Services(AsMember());
        using (db)
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => svc.SubmitHealthAsync(
                new SubmitHealthRequest { Answers = [false, false, false, false, false, false, false] }, Meta));
            Assert.Equal("HEALTH_CONSENT_REQUIRED", ex.Code);
            Assert.Equal(422, ex.StatusCode);
            await Assert.ThrowsAsync<ArgumentException>(() => svc.SubmitHealthAsync(
                new SubmitHealthRequest { Answers = [false], GrantHealthDataConsent = true }, Meta));
        }

        await SubmitHealthAsync();
        using var check = _db.Create(null);
        var consent = await check.ConsentRecords.SingleAsync();
        Assert.Equal(ConsentTypes.HealthData, consent.Type);
        Assert.True(consent.Granted);
        Assert.Equal("health_form", consent.Source);
    }

    [Fact]
    public async Task Consents_are_append_only()
    {
        var me = AsMember();
        using (var db = _db.Create(me))
        {
            var svc = new ConsentService(db, me);
            await svc.RecordMineAsync(new RecordConsentRequest { Type = "marketing_email", Granted = true }, null);
            await svc.RecordMineAsync(new RecordConsentRequest { Type = "marketing_email", Granted = true }, null); // no-op
            var after = await svc.RecordMineAsync(new RecordConsentRequest { Type = "marketing_email", Granted = false }, null);
            Assert.False(after.Current.Single(c => c.Type == "marketing_email").Granted);
            Assert.Equal(2, after.History.Count);
            await Assert.ThrowsAsync<ArgumentException>(() => svc.RecordMineAsync(new RecordConsentRequest { Type = "spam", Granted = true }, null));
        }

        using var raw = _db.Create(null);
        var row = await raw.ConsentRecords.FirstAsync();
        row.Granted = !row.Granted;
        Assert.Throws<InvalidOperationException>(() => raw.SaveChanges());
    }

    // ── Health visibility ───────────────────────────────────────────────────

    [Fact]
    public async Task Health_answers_are_visible_only_to_the_member_admins_and_assigned_trainers()
    {
        await SubmitHealthAsync(anyYes: true);

        async Task<bool> CanRead(FakeUser who)
        {
            var (db, svc, _) = Services(who);
            using (db)
            {
                try { return (await svc.GetMemberHealthAsync(Member)).Count == 1; }
                catch (UnauthorizedAccessException) { return false; }
            }
        }

        Assert.True(await CanRead(AsMember()));
        Assert.True(await CanRead(As(Admin, "admin")));
        Assert.True(await CanRead(As(Trainer, "trainer")));
        Assert.False(await CanRead(As(OtherTrainer, "trainer")));
        Assert.False(await CanRead(As(Staff, "staff")));
        Assert.False(await CanRead(AsMember(OtherMember)));

        // The member-detail summary tells the UI whether to offer the answers.
        var (dbA, admin, _) = Services(As(Admin, "admin"));
        using (dbA) Assert.True((await admin.GetMemberSafetyAsync(Member)).CanViewHealthAnswers);
        var (dbS, staff, _) = Services(As(Staff, "staff"));
        using (dbS) Assert.False((await staff.GetMemberSafetyAsync(Member)).CanViewHealthAnswers);
    }

    [Fact]
    public async Task Only_staff_with_health_access_can_record_clearance()
    {
        var s = await SubmitHealthAsync(anyYes: true);

        var (dbT, trainer, _) = Services(As(Trainer, "trainer"));
        using (dbT) await Assert.ThrowsAsync<UnauthorizedAccessException>(() => trainer.ClearHealthAsync(Member, s.Id, new ClearHealthRequest()));

        var (dbA, admin, gate) = Services(As(Admin, "admin"));
        using (dbA)
        {
            var cleared = await admin.ClearHealthAsync(Member, s.Id, new ClearHealthRequest { Note = "GP letter on file" });
            Assert.NotNull(cleared.ClearedAt);
            Assert.Equal("cleared", (await gate.EvaluateAsync(Member)).Health.Status);
        }
    }

    // ── Emergency contact ───────────────────────────────────────────────────

    [Fact]
    public async Task Emergency_contact_reads_through_the_legacy_profile_field_until_saved()
    {
        using (var seed = _db.Create(null))
        {
            seed.ClientProfiles.Add(new Domain.Entities.Health.ClientProfile
            {
                TenantId = 1, UserId = Member,
                EmergencyContact = System.Text.Json.JsonDocument.Parse("\"Priya Shah (sister) +91 98765 43210\""),
            });
            await seed.SaveChangesAsync();
        }

        var (db, svc, _) = Services(AsMember());
        using (db)
        {
            var legacy = await svc.GetMyEmergencyContactAsync();
            Assert.NotNull(legacy);
            Assert.Equal("legacy", legacy!.Source);
            Assert.Equal("Priya Shah", legacy.Name);
            Assert.Equal("sister", legacy.Relationship);
            Assert.Equal("+91 98765 43210", legacy.Phone);

            await Assert.ThrowsAsync<ArgumentException>(() => svc.SetMyEmergencyContactAsync(new EmergencyContactRequest { Name = "Priya", Phone = "12" }));
            var saved = await svc.SetMyEmergencyContactAsync(new EmergencyContactRequest { Name = "Priya Shah", Relationship = "Sister", Phone = "+91 98765 43210" });
            Assert.Equal("profile", saved.Source);
            Assert.Equal("profile", (await svc.GetMyEmergencyContactAsync())!.Source);
        }
    }

    [Theory]
    [InlineData("{\"name\":\"Raj\",\"relation\":\"father\",\"phone\":\"9876543210\"}", "Raj", "father", "9876543210")]
    [InlineData("{\"Name\":\"Ana\",\"PhoneNumber\":\"+1 (555) 010-2000\"}", "Ana", null, "+1 (555) 010-2000")]
    [InlineData("\"Mum - 07700 900123\"", "Mum", null, "07700 900123")]
    public void Legacy_emergency_contact_formats_are_parsed(string json, string name, string? relation, string phone)
    {
        var c = EmergencyContacts.FromLegacy(System.Text.Json.JsonDocument.Parse(json));
        Assert.NotNull(c);
        Assert.Equal(name, c!.Name);
        Assert.Equal(relation, c.Relationship);
        Assert.Equal(phone, c.Phone);
    }

    [Fact]
    public void Legacy_emergency_contact_without_a_phone_is_ignored() =>
        Assert.Null(EmergencyContacts.FromLegacy(System.Text.Json.JsonDocument.Parse("\"ask reception\"")));

    public void Dispose() => _db.Dispose();
}
