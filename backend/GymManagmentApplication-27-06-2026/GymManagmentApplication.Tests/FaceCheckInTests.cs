using System.Text.Json;
using GymManagmentApplication.Application.Attendance;
using GymManagmentApplication.Application.Attendance.Face;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Privacy;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using GymManagmentApplication.Infrastructure.FaceMatching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>Face verification for self check-in ("selfie + photo match"), with a fake face matcher.</summary>
public class FaceCheckInTests : IDisposable
{
    private const ulong Admin = 1, Member = 100, OtherMember = 101, OtherGymAdmin = 2, OtherGymMember = 200;
    private const ulong Branch = 11;
    private const double Lat = 19.076, Lng = 72.8777;

    private readonly TestDb _db = new();
    private readonly FakeFaceMatcher _matcher = new();
    private readonly MemoryStorage _storage = new();

    public FaceCheckInTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        using (var db = _db.Create(null))
        {
            db.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 22, TenantId = 2, Name = "Admin", Slug = "admin" });
            var branch = db.Branches.Single(b => b.Id == Branch);
            branch.Lat = (decimal)Lat;
            branch.Lng = (decimal)Lng;
            branch.LocationCheckInEnabled = true;
            branch.GeofenceRadiusM = 150;
            db.SaveChanges();
        }
        AddUser(Admin, 1, 12, "Ada", "Admin");
        AddUser(OtherGymAdmin, 2, 22, "Oli", "Admin");
        _db.AddMember(Member, branchId: Branch);
        _db.AddMember(OtherMember, branchId: Branch);
        _db.AddMember(OtherGymMember, tenantId: 2);
    }

    public void Dispose() => _db.Dispose();

    private void AddUser(ulong id, ulong tenantId, ulong roleId, string first, string last)
    {
        using var db = _db.Create(null);
        db.Users.Add(new User
        {
            Id = id, TenantId = tenantId, RoleId = roleId, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
            FirstName = first, LastName = last, Status = Domain.Enums.UserStatus.Active,
        });
        db.SaveChanges();
    }

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsAdmin(ulong id = Admin, ulong tenant = 1) => new() { UserId = id, Role = "admin", TenantId = tenant };

    private FaceCheckInService Face(AppDbContext db, ICurrentUser user, IFileStorage? storage = null) =>
        new(db, user, _matcher, storage ?? _storage, NullLogger<FaceCheckInService>.Instance);

    private AttendanceService Attendance(AppDbContext db, ICurrentUser user, bool withFace = true) =>
        new(db, user, null, null, withFace ? Face(db, user) : null);

    private static LocationCheckRequest Here => new() { Lat = Lat, Lng = Lng, AccuracyM = 10 };
    private static LocationCheckRequest FarAway => new() { Lat = Lat + 0.05, Lng = Lng, AccuracyM = 10 };

    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 1, 2, 3, 4, 5, 6];
    private static FileUpload Photo(byte[]? bytes = null) => FileUpload.FromBytes("selfie.jpg", "image/jpeg", bytes ?? Jpeg);
    private static FaceSelfie Selfie(DateTime? capturedAt = null) => new(Photo(), capturedAt ?? DateTime.UtcNow);

    private async Task EnableAsync(int threshold = 90, int keepDays = 30)
    {
        using var db = _db.Create(AsAdmin());
        await Attendance(db, AsAdmin()).UpdateSettingsAsync(new AttendanceSettings
        {
            FaceCheckEnabled = true, FaceMatchThreshold = threshold, KeepCheckInSelfiesDays = keepDays,
        });
    }

    private async Task EnrollAsync(ulong member = Member)
    {
        using var db = _db.Create(AsMember(member));
        await Face(db, AsMember(member)).EnrollMineAsync(Photo(), consent: true, DateTime.UtcNow, "10.0.0.1");
    }

    private async Task<CheckInResultResponse> CheckInAsync(FaceSelfie? selfie, LocationCheckRequest? at = null, ulong member = Member)
    {
        using var db = _db.Create(AsMember(member));
        return await Attendance(db, AsMember(member)).CheckInByLocationAsync(at ?? Here, selfie);
    }

    private async Task<RuleException> CheckInFailsAsync(FaceSelfie? selfie, ulong member = Member) =>
        await Assert.ThrowsAsync<RuleException>(() => CheckInAsync(selfie, member: member));

    private List<FaceCheckInAttempt> Attempts()
    {
        using var db = _db.Create(null);
        return db.FaceCheckInAttempts.AsEnumerable().OrderBy(a => a.Id).ToList();
    }

    private int Visits(ulong member = Member)
    {
        using var db = _db.Create(null);
        return db.Attendances.Count(a => a.UserId == member);
    }

    // ── Settings ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Face_check_is_off_by_default_and_check_in_stays_location_only()
    {
        using (var db = _db.Create(AsAdmin()))
        {
            var s = await Attendance(db, AsAdmin()).GetSettingsAsync();
            Assert.False(s.Settings.FaceCheckEnabled);
            Assert.Equal(90, s.Settings.FaceMatchThreshold);
            Assert.Equal(30, s.Settings.KeepCheckInSelfiesDays);
            Assert.True(s.FaceServiceConfigured);
        }

        var result = await CheckInAsync(selfie: null);
        Assert.True(result.CheckedIn);
        Assert.Null(result.Visit!.FaceVerified);
        Assert.Equal(0, _matcher.Calls);
    }

    [Fact]
    public async Task Enabling_is_refused_when_the_face_service_or_private_storage_is_not_configured()
    {
        _matcher.Configured = false;
        using (var db = _db.Create(AsAdmin()))
        {
            var svc = Attendance(db, AsAdmin());
            var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.UpdateSettingsAsync(new AttendanceSettings { FaceCheckEnabled = true }));
            Assert.Contains("face matching service", ex.Message);
            Assert.False((await svc.GetSettingsAsync()).FaceServiceConfigured);
            // Saving everything else still works while it stays off.
            await svc.UpdateSettingsAsync(new AttendanceSettings { FaceCheckEnabled = false, DefaultRadiusM = 120 });
        }

        _matcher.Configured = true;
        var publicOnly = new MemoryStorage { Private = false };
        using (var db = _db.Create(AsAdmin()))
        {
            var svc = new AttendanceService(db, AsAdmin(), null, null, Face(db, AsAdmin(), publicOnly));
            var ex = await Assert.ThrowsAsync<ArgumentException>(() => svc.UpdateSettingsAsync(new AttendanceSettings { FaceCheckEnabled = true }));
            Assert.Contains("private file storage", ex.Message);
        }
    }

    [Theory]
    [InlineData(79, 30)]
    [InlineData(100, 30)]
    [InlineData(90, -1)]
    [InlineData(90, 91)]
    public async Task Threshold_and_retention_ranges_are_enforced(int threshold, int keepDays)
    {
        using var db = _db.Create(AsAdmin());
        await Assert.ThrowsAsync<ArgumentException>(() => Attendance(db, AsAdmin()).UpdateSettingsAsync(new AttendanceSettings
        {
            FaceCheckEnabled = true, FaceMatchThreshold = threshold, KeepCheckInSelfiesDays = keepDays,
        }));
    }

    // ── Enrolment ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Enrolment_needs_consent_and_stores_the_photo_privately()
    {
        using (var db = _db.Create(AsMember()))
        {
            var ex = await Assert.ThrowsAsync<RuleException>(() => Face(db, AsMember()).EnrollMineAsync(Photo(), consent: false, DateTime.UtcNow, null));
            Assert.Equal(FaceCheckCodes.ConsentRequired, ex.Code);
        }
        Assert.Empty(_storage.Saved);

        await EnrollAsync();
        using var check = _db.Create(null);
        var e = await check.FaceEnrollments.SingleAsync();
        Assert.Equal(Member, e.UserId);
        Assert.Equal(1UL, e.TenantId);
        Assert.Equal(FaceEnrollmentStatuses.Active, e.Status);
        Assert.Equal("self", e.Source);
        Assert.Equal(Member, e.EnrolledByUserId);
        Assert.Equal(FileKind.FaceImage, _storage.Saved.Single().Kind);
        Assert.Equal(e.PhotoUrl, _storage.Saved.Single().Url);
        var consent = await check.ConsentRecords.SingleAsync();
        Assert.Equal(ConsentTypes.BiometricFace, consent.Type);
        Assert.True(consent.Granted);
        Assert.Contains(check.AuditLogs, a => a.Action == "face.enrolled" && a.EntityId == Member);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(2, 2)]
    [InlineData(1, 0)]
    public async Task Enrolment_refuses_a_photo_without_exactly_one_clear_face(int faces, int clear)
    {
        _matcher.DetectFaces = faces;
        _matcher.DetectClear = clear;
        using var db = _db.Create(AsMember());
        var ex = await Assert.ThrowsAsync<RuleException>(() => Face(db, AsMember()).EnrollMineAsync(Photo(), consent: true, DateTime.UtcNow, null));
        Assert.Equal(FaceCheckCodes.NotClear, ex.Code);
        Assert.Empty(_storage.Saved);
        Assert.False(await db.FaceEnrollments.AnyAsync());
    }

    [Fact]
    public async Task Enrolment_checks_the_file_type_size_and_capture_time()
    {
        using var db = _db.Create(AsMember());
        var face = Face(db, AsMember());
        var gif = "GIF89a-not-a-photo"u8.ToArray();
        await Assert.ThrowsAsync<ArgumentException>(() => face.EnrollMineAsync(Photo(gif), true, DateTime.UtcNow, null));
        var huge = new byte[FaceImages.MaxBytes + 1];
        Jpeg.CopyTo(huge, 0);
        await Assert.ThrowsAsync<ArgumentException>(() => face.EnrollMineAsync(Photo(huge), true, DateTime.UtcNow, null));
        var stale = await Assert.ThrowsAsync<ArgumentException>(() => face.EnrollMineAsync(Photo(), true, DateTime.UtcNow.AddMinutes(-30), null));
        Assert.Contains("too old", stale.Message);
        Assert.Empty(_storage.Saved);
    }

    [Fact]
    public async Task Enrolment_is_refused_without_private_storage_outside_development()
    {
        var publicOnly = new MemoryStorage { Private = false };
        using var db = _db.Create(AsMember());
        var ex = await Assert.ThrowsAsync<RuleException>(() =>
            Face(db, AsMember(), publicOnly).EnrollMineAsync(Photo(), true, DateTime.UtcNow, null));
        Assert.Contains("private file storage", ex.Message);
        Assert.Empty(publicOnly.Saved);
    }

    [Fact]
    public async Task Staff_enrol_at_the_desk_reset_and_delete_with_an_audit_trail()
    {
        using (var db = _db.Create(AsAdmin()))
        {
            var face = Face(db, AsAdmin());
            var ex = await Assert.ThrowsAsync<RuleException>(() => face.EnrollMemberAsync(Member, Photo(), consentConfirmed: false, DateTime.UtcNow, null));
            Assert.Equal(FaceCheckCodes.ConsentRequired, ex.Code);

            var status = await face.EnrollMemberAsync(Member, Photo(), consentConfirmed: true, DateTime.UtcNow, null);
            Assert.True(status.Enrolled);
            Assert.Equal("desk", status.Source);
            Assert.Equal("Ada Admin", status.EnrolledByName);
            Assert.NotNull(status.PhotoUrl);

            var reset = await face.ResetMemberAsync(Member);
            Assert.False(reset.Enrolled);
            Assert.Equal(FaceEnrollmentStatuses.ResetRequired, reset.Status);
            Assert.Single(_storage.Deleted);

            Assert.True(await face.DeleteMemberAsync(Member));
            Assert.False(await face.DeleteMemberAsync(Member));
        }

        using var check = _db.Create(null);
        var consent = await check.ConsentRecords.SingleAsync();
        Assert.Equal("desk", consent.Source);
        Assert.Equal(Admin, consent.RecordedByUserId);
        var actions = await check.AuditLogs.Where(a => a.EntityId == Member).Select(a => a.Action).ToListAsync();
        Assert.Equal(["face.enrolled", "face.reset", "face.deleted"], actions);
        Assert.False(await check.FaceEnrollments.AnyAsync());
    }

    // ── Check-in ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Enabled_and_not_enrolled_answers_FACE_ENROLL_REQUIRED_once_location_passes()
    {
        await EnableAsync();

        // Out of range is still the normal "you're 5 km away" answer: the face step comes after location.
        var far = await CheckInAsync(selfie: null, FarAway);
        Assert.False(far.CheckedIn);
        Assert.NotNull(far.DistanceM);
        Assert.False(far.FaceRequired);

        var ex = await CheckInFailsAsync(selfie: null);
        Assert.Equal(FaceCheckCodes.EnrollRequired, ex.Code);
        Assert.Equal(422, ex.StatusCode);
        // Also with a selfie: there's nothing to compare it with.
        Assert.Equal(FaceCheckCodes.EnrollRequired, (await CheckInFailsAsync(Selfie())).Code);
        Assert.Equal(0, Visits());
        Assert.Equal(0, _matcher.Calls);
    }

    [Fact]
    public async Task Enrolled_member_without_a_selfie_is_asked_for_one()
    {
        await EnableAsync();
        await EnrollAsync();

        using (var db = _db.Create(AsMember()))
        {
            var status = await Attendance(db, AsMember()).GetMyStatusAsync();
            Assert.True(status.FaceCheckRequired);
            Assert.True(status.FaceEnrolled);
        }

        var result = await CheckInAsync(selfie: null);
        Assert.False(result.CheckedIn);
        Assert.True(result.FaceRequired);
        Assert.Equal(0, Visits());
    }

    [Fact]
    public async Task A_match_above_the_threshold_checks_in_and_records_the_score()
    {
        await EnableAsync(threshold: 90, keepDays: 30);
        await EnrollAsync();
        _matcher.Similarity = 97.4;

        var result = await CheckInAsync(Selfie());
        Assert.True(result.CheckedIn);
        Assert.True(result.Visit!.FaceVerified);
        Assert.Equal(97.4m, result.Visit.FaceScore);
        Assert.Equal(1, _matcher.Calls);
        // The reference photo was read back from (private) storage and compared with the selfie.
        Assert.Equal(_storage.Saved[0].Url, _storage.ReadUrls.Single());

        var attempt = Attempts().Single();
        Assert.Equal(FaceAttemptOutcomes.Matched, attempt.Outcome);
        Assert.Equal(result.Visit.Id, attempt.AttendanceId);
        Assert.Equal(90, attempt.Threshold);
        Assert.NotNull(attempt.SelfieUrl); // kept for 30 days

        // Staff see the badge and can open the kept selfie next to the reference photo.
        using var db = _db.Create(AsAdmin());
        var log = await Attendance(db, AsAdmin()).GetAllAsync(null, null, 1, 20);
        var row = log.Items.Single();
        Assert.True(row.FaceVerified);
        Assert.Equal(attempt.Id, row.FaceAttemptId);
        Assert.True(row.HasFaceSelfie);
        var photos = await Face(db, AsAdmin()).GetAttemptPhotosAsync(attempt.Id);
        Assert.NotNull(photos!.SelfieUrl);
        Assert.NotNull(photos.ReferenceUrl);
    }

    [Fact]
    public async Task Selfies_are_not_kept_when_retention_is_zero()
    {
        await EnableAsync(keepDays: 0);
        await EnrollAsync();
        Assert.True((await CheckInAsync(Selfie())).CheckedIn);
        Assert.Null(Attempts().Single().SelfieUrl);
        Assert.Single(_storage.Saved); // only the reference photo
    }

    [Fact]
    public async Task A_match_below_the_threshold_is_FACE_MISMATCH_and_logged_for_staff()
    {
        await EnableAsync(threshold: 95);
        await EnrollAsync();
        _matcher.Similarity = 93.0; // would pass at 90

        var ex = await CheckInFailsAsync(Selfie());
        Assert.Equal(FaceCheckCodes.Mismatch, ex.Code);
        Assert.Equal(0, Visits());
        var attempt = Attempts().Single();
        Assert.Equal(FaceAttemptOutcomes.Mismatch, attempt.Outcome);
        Assert.Equal(93.0m, attempt.Similarity);
        Assert.Null(attempt.AttendanceId);

        using var db = _db.Create(AsAdmin());
        var failed = await Face(db, AsAdmin()).GetAttemptsAsync(null, null, failedOnly: true, 1, 20);
        Assert.Equal(Member, failed.Items.Single().UserId);
        Assert.Equal("North", failed.Items.Single().BranchName);
        // Nobody is notified about a failed face check.
        Assert.False(await db.Notifications.AnyAsync());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    public async Task No_face_or_several_faces_is_FACE_NOT_CLEAR(int faces)
    {
        await EnableAsync();
        await EnrollAsync();
        _matcher.ProbeFaces = faces;

        var ex = await CheckInFailsAsync(Selfie());
        Assert.Equal(FaceCheckCodes.NotClear, ex.Code);
        Assert.Equal(0, Visits());
        Assert.Equal(FaceAttemptOutcomes.NotClear, Attempts().Single().Outcome);
    }

    [Fact]
    public async Task A_face_service_failure_fails_closed()
    {
        await EnableAsync();
        await EnrollAsync();
        _matcher.Fail = true;

        var ex = await CheckInFailsAsync(Selfie());
        Assert.Equal(FaceCheckCodes.Unavailable, ex.Code);
        Assert.Equal(503, ex.StatusCode);
        Assert.Contains("front desk", ex.Message);
        Assert.Equal(0, Visits());
        Assert.Equal(FaceAttemptOutcomes.Unavailable, Attempts().Single().Outcome);
    }

    [Fact]
    public async Task A_missing_reference_file_also_fails_closed()
    {
        await EnableAsync();
        await EnrollAsync();
        _storage.Files.Clear();

        var ex = await CheckInFailsAsync(Selfie());
        Assert.Equal(FaceCheckCodes.Unavailable, ex.Code);
        Assert.Equal(0, Visits());
    }

    [Fact]
    public async Task Three_mismatches_in_ten_minutes_send_the_member_to_the_front_desk()
    {
        await EnableAsync();
        await EnrollAsync();
        _matcher.Similarity = 40;

        for (var i = 0; i < FaceCheckInService.MaxMismatches; i++)
            Assert.Equal(FaceCheckCodes.Mismatch, (await CheckInFailsAsync(Selfie())).Code);
        Assert.Equal(3, _matcher.Calls);

        // Even a good selfie is refused for now, without calling the face service.
        _matcher.Similarity = 99;
        var locked = await CheckInFailsAsync(Selfie());
        Assert.Equal(FaceCheckCodes.Locked, locked.Code);
        Assert.Contains("front desk", locked.Message);
        Assert.Equal(3, _matcher.Calls);
        Assert.Equal(0, Visits());

        // Another member isn't affected; after the window the member can try again.
        await EnrollAsync(OtherMember);
        Assert.True((await CheckInAsync(Selfie(), member: OtherMember)).CheckedIn);
        using (var db = _db.Create(null))
        {
            foreach (var a in db.FaceCheckInAttempts.Where(a => a.UserId == Member)) a.At = a.At.AddMinutes(-11);
            await db.SaveChangesAsync();
        }
        Assert.True((await CheckInAsync(Selfie())).CheckedIn);
    }

    [Fact]
    public async Task A_stale_selfie_is_refused()
    {
        await EnableAsync();
        await EnrollAsync();
        await Assert.ThrowsAsync<ArgumentException>(() => CheckInAsync(Selfie(DateTime.UtcNow.AddMinutes(-20))));
        Assert.Equal(0, _matcher.Calls);
    }

    [Fact]
    public async Task Front_desk_check_in_is_unaffected()
    {
        await EnableAsync();
        using var db = _db.Create(AsAdmin());
        var result = await Attendance(db, AsAdmin()).CheckInMemberAsync(Member);
        Assert.True(result.CheckedIn);
        Assert.Null(result.Visit!.FaceVerified);
        Assert.Equal(0, _matcher.Calls);
    }

    [Fact]
    public async Task Trainers_self_check_in_stays_location_only()
    {
        await EnableAsync();
        var trainer = new FakeUser { UserId = Admin, Role = "trainer", TenantId = 1 };
        using var tdb = _db.Create(trainer);
        Assert.True((await Attendance(tdb, trainer).CheckInByLocationAsync(Here)).CheckedIn);
    }

    // ── Tenant isolation ─────────────────────────────────────────────────────

    [Fact]
    public async Task Staff_of_another_gym_cannot_see_or_change_a_members_face_data()
    {
        await EnableAsync();
        await EnrollAsync();
        _matcher.Similarity = 10;
        await CheckInFailsAsync(Selfie());

        var other = AsAdmin(OtherGymAdmin, 2);
        using var db = _db.Create(other);
        var face = Face(db, other);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => face.GetMemberAsync(Member));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => face.ResetMemberAsync(Member));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => face.EnrollMemberAsync(Member, Photo(), true, DateTime.UtcNow, null));
        Assert.Empty((await face.GetAttemptsAsync(null, null, false, 1, 20)).Items);
        Assert.Null(await face.GetAttemptPhotosAsync(Attempts().Single().Id));
    }

    // ── Privacy & retention ──────────────────────────────────────────────────

    [Fact]
    public async Task Withdrawing_consent_deletes_the_reference_photo_and_kept_selfies()
    {
        await EnableAsync();
        await EnrollAsync();
        Assert.True((await CheckInAsync(Selfie())).CheckedIn);
        var reference = _storage.Saved[0].Url;
        var selfie = Attempts().Single().SelfieUrl!;

        using (var db = _db.Create(AsMember()))
        {
            var consents = new ConsentService(db, AsMember(), [new FaceConsentWithdrawalHandler(db, _storage)]);
            await consents.RecordMineAsync(new RecordConsentRequest { Type = ConsentTypes.BiometricFace, Granted = false }, null);
        }

        Assert.Contains(reference, _storage.Deleted);
        Assert.Contains(selfie, _storage.Deleted);
        using var check = _db.Create(null);
        Assert.False(await check.FaceEnrollments.AnyAsync());
        Assert.Null(check.FaceCheckInAttempts.Single().SelfieUrl);
        // The next check-in asks to enrol again.
        using (var db = _db.Create(AsMember())) await Attendance(db, AsMember()).CheckOutAsync(null);
        Assert.Equal(FaceCheckCodes.EnrollRequired, (await CheckInFailsAsync(null)).Code);
    }

    [Fact]
    public async Task Remove_my_face_data_deletes_everything_and_withdraws_consent()
    {
        await EnrollAsync();
        using var db = _db.Create(AsMember());
        var status = await Face(db, AsMember()).RemoveMineAsync(null);
        Assert.False(status.Enrolled);
        Assert.False(status.ConsentGranted);
        Assert.Single(_storage.Deleted);
        Assert.False(await db.FaceEnrollments.AnyAsync());
        var latest = (await db.ConsentRecords.ToListAsync()).OrderByDescending(c => c.Id).First();
        Assert.False(latest.Granted);
    }

    [Fact]
    public async Task The_retention_job_deletes_only_selfies_older_than_the_gyms_setting()
    {
        await EnableAsync(keepDays: 30);
        await EnrollAsync();
        Assert.True((await CheckInAsync(Selfie())).CheckedIn);
        await EnrollAsync(OtherMember);
        Assert.True((await CheckInAsync(Selfie(), member: OtherMember)).CheckedIn);
        using (var db = _db.Create(null))
        {
            var old = db.FaceCheckInAttempts.Single(a => a.UserId == Member);
            old.At = DateTime.UtcNow.AddDays(-31);
            await db.SaveChangesAsync();
        }

        using (var job = _db.Create(null))
            Assert.Equal(1, await FaceCheckInService.PurgeExpiredSelfiesAsync(job, _storage, 1, DateTime.UtcNow));

        var attempts = Attempts();
        Assert.Null(attempts.Single(a => a.UserId == Member).SelfieUrl);
        Assert.NotNull(attempts.Single(a => a.UserId == OtherMember).SelfieUrl);
        Assert.Single(_storage.Deleted);
        // Reference photos are never touched by retention.
        using var check = _db.Create(null);
        Assert.Equal(2, await check.FaceEnrollments.CountAsync(e => e.PhotoUrl != null));
    }

    [Fact]
    public async Task Privacy_export_has_the_status_but_no_images_and_anonymisation_deletes_them()
    {
        await EnableAsync();
        await EnrollAsync();
        Assert.True((await CheckInAsync(Selfie())).CheckedIn);
        var files = _storage.Saved.Select(s => s.Url).ToList();
        Assert.Equal(2, files.Count); // reference + kept selfie

        using (var db = _db.Create(null))
        {
            var processor = Processor(db);
            Assert.Contains("faceCheckIn", PrivacyProcessor.ExportSections);
            var export = await processor.CollectExportAsync(1, Member);
            var json = JsonSerializer.Serialize(export["faceCheckIn"]);
            Assert.Contains("\"Status\":\"active\"", json);
            Assert.Contains("\"Outcome\":\"matched\"", json);
            var attendance = JsonSerializer.Serialize(export["attendance"]);
            foreach (var url in files) { Assert.DoesNotContain(url, json); Assert.DoesNotContain(url, attendance); }

            db.AccountDeletionRequests.Add(new AccountDeletionRequest
            {
                TenantId = 1, UserId = Member, RequestedByUserId = Member, ScheduledFor = DateTime.UtcNow.AddDays(-1),
            });
            await db.SaveChangesAsync();
            Assert.Equal(1, await processor.RunDueDeletionsAsync(1, DateTime.UtcNow));
        }

        foreach (var url in files) Assert.Contains(url, _storage.Deleted);
        using var check = _db.Create(null);
        Assert.False(await check.FaceEnrollments.AnyAsync(e => e.UserId == Member));
        Assert.False(await check.FaceCheckInAttempts.AnyAsync(a => a.UserId == Member));
        Assert.Equal(97.4m, (await check.Attendances.SingleAsync(a => a.UserId == Member)).FaceScore);
    }

    private PrivacyProcessor Processor(AppDbContext db) =>
        new(db, _storage, new EmailOutbox(db), new Notifier(db, new FakeUser { UserId = null, IsAuthenticated = false }),
            NullLogger<PrivacyProcessor>.Instance);

    [Fact]
    public async Task Without_aws_keys_the_disabled_matcher_is_registered_and_fails_closed()
    {
        var services = new ServiceCollection();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["FaceMatching:Provider"] = "aws", ["Aws:Region"] = "ap-south-1" })
            .Build();
        services.AddFaceMatching(config);
        using var sp = services.BuildServiceProvider();
        var matcher = sp.GetRequiredService<IFaceMatcher>();
        Assert.IsType<DisabledFaceMatcher>(matcher);
        Assert.False(matcher.IsConfigured);
        await Assert.ThrowsAsync<FaceServiceUnavailableException>(() => matcher.CompareAsync(Stream.Null, Stream.Null));
    }

    // ── Fakes ────────────────────────────────────────────────────────────────

    /// <summary>Test double for <see cref="IFaceMatcher"/>: fixed similarity / face counts, or a failure.</summary>
    private sealed class FakeFaceMatcher : IFaceMatcher
    {
        public bool Configured { get; set; } = true;
        public double Similarity { get; set; } = 97.4;
        public int ProbeFaces { get; set; } = 1;
        public int DetectFaces { get; set; } = 1;
        public int DetectClear { get; set; } = 1;
        public bool Fail { get; set; }
        public int Calls { get; private set; }

        public bool IsConfigured => Configured;

        public Task<FaceMatchResult> CompareAsync(Stream reference, Stream probe, CancellationToken ct = default)
        {
            Calls++;
            if (Fail) throw new FaceServiceUnavailableException("boom");
            return Task.FromResult(new FaceMatchResult(true, ProbeFaces, ProbeFaces == 1 ? Similarity : null));
        }

        public Task<FaceDetectResult> DetectAsync(Stream image, CancellationToken ct = default)
        {
            if (Fail) throw new FaceServiceUnavailableException("boom");
            return Task.FromResult(new FaceDetectResult(DetectFaces, DetectClear));
        }
    }

    /// <summary>In-memory private storage that can read files back.</summary>
    private sealed class MemoryStorage : IFileStorage
    {
        public bool Private { get; set; } = true;
        public readonly Dictionary<string, byte[]> Files = [];
        public readonly List<(string Url, FileKind Kind)> Saved = [];
        public readonly List<string> Deleted = [];
        public readonly List<string> ReadUrls = [];

        public bool SupportsPrivateFiles => Private;

        public async Task<string> SaveAsync(FileUpload file, string folder, FileKind kind)
        {
            using var ms = new MemoryStream();
            await using (var s = file.OpenReadStream()) await s.CopyToAsync(ms);
            var url = $"https://private.test/{folder}/{Guid.NewGuid():N}.jpg";
            Files[url] = ms.ToArray();
            Saved.Add((url, kind));
            return url;
        }

        public Task DeleteAsync(string? url)
        {
            if (url is not null) { Deleted.Add(url); Files.Remove(url); }
            return Task.CompletedTask;
        }

        public Task<string> GetSignedUrlAsync(string url) => Task.FromResult(url + "?signed=1");

        public Task<Stream> OpenReadAsync(string url)
        {
            ReadUrls.Add(url);
            return Files.TryGetValue(url, out var bytes)
                ? Task.FromResult<Stream>(new MemoryStream(bytes))
                : throw new FileNotFoundException("missing");
        }
    }
}
