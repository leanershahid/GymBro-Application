using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Entities.Scheduling;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GymManagmentApplication.Application.Attendance.Face;

/// <summary>
/// Face verification for self check-in ("selfie + photo match"), optional per gym and off by default
/// (attendance settings <c>faceCheckEnabled</c>). A member enrols a reference selfie once, after
/// agreeing to the "biometric_face" consent; at each self check-in, after the location (and the
/// safety / opening-hours gates) pass, a live selfie is compared with that photo by
/// <see cref="IFaceMatcher"/> (AWS Rekognition CompareFaces). Only a match at or above the gym's
/// threshold checks the member in. Any service failure fails closed (nobody is checked in).
/// <para>
/// Liveness is NOT verified (Rekognition Face Liveness needs its own SDK flow): the app only allows a
/// live front-camera capture (no gallery) and sends the capture time, which is checked here. A
/// printed photo or a screen held up to the camera can still pass; staff can review kept selfies.
/// </para>
/// Front-desk check-in never uses any of this.
/// </summary>
public class FaceCheckInService(
    IAppDbContext db,
    ICurrentUser currentUser,
    IFaceMatcher matcher,
    IFileStorage storage,
    ILogger<FaceCheckInService> logger,
    IHostEnvironment? env = null)
{
    /// <summary>Mismatches allowed per <see cref="MismatchWindow"/> before the member must use the front desk.</summary>
    public const int MaxMismatches = 3;
    public static readonly TimeSpan MismatchWindow = TimeSpan.FromMinutes(10);
    /// <summary>A selfie older than this (by the app's capture time) is refused: take a new one.</summary>
    public static readonly TimeSpan MaxCaptureAge = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(2);
    /// <summary>Wall-clock limit for one face-service call (the AWS client has its own shorter timeout).</summary>
    private static readonly TimeSpan ServiceTimeout = TimeSpan.FromSeconds(15);
    public const string ConsentVersion = "1";

    public const string UnavailableMessage = "Face check unavailable — check in at the front desk.";
    public const string LockedMessage = "Too many face check attempts. Please check in at the front desk.";

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");

    /// <summary>A face service is configured (AWS keys present).</summary>
    public bool FaceServiceConfigured => matcher.IsConfigured;

    /// <summary>"local", "aws" or "none" (for the settings page and the consent text).</summary>
    public string FaceProvider => matcher.IsConfigured ? matcher.ProviderName : "none";

    /// <summary>Face photos can be stored privately. Local disk storage is public, so only a development server may use it.</summary>
    public bool PrivateStorageReady => storage.SupportsPrivateFiles || env?.IsDevelopment() == true;

    // ── Member ───────────────────────────────────────────────────────────────

    public async Task<MyFaceStatusResponse> GetMineAsync()
    {
        var tenantId = currentUser.ResolveTenantId();
        var settings = await AttendanceService.LoadSettingsAsync(db, tenantId);
        var e = await EnrollmentAsync(tenantId, Me);
        return new MyFaceStatusResponse
        {
            Required = settings.FaceCheckEnabled,
            Enrolled = IsActive(e),
            Status = e?.Status,
            EnrolledAt = e?.EnrolledAt,
            Source = e?.Source,
            ConsentGranted = await Consents.IsGrantedAsync(db, tenantId, Me, ConsentTypes.BiometricFace),
            PhotoUrl = await SignAsync(e?.PhotoUrl),
            KeepCheckInSelfiesDays = settings.KeepCheckInSelfiesDays,
            FaceProvider = FaceProvider,
        };
    }

    /// <summary>
    /// The member enrols (or re-enrols) their reference selfie. <paramref name="consent"/> = they agreed
    /// on the consent screen just now; required unless the "biometric_face" consent is already granted.
    /// </summary>
    public async Task<MyFaceStatusResponse> EnrollMineAsync(FileUpload photo, bool consent, DateTime? capturedAt, string? ip)
    {
        var tenantId = currentUser.ResolveTenantId();
        var me = Me;
        var granted = await Consents.IsGrantedAsync(db, tenantId, me, ConsentTypes.BiometricFace);
        if (!granted && !consent)
            throw new RuleException("Please agree to face check-in before taking your photo.", RuleException.UnprocessableStatus)
                { Code = FaceCheckCodes.ConsentRequired };

        var (_, oldPhoto) = await EnrollCoreAsync(tenantId, me, photo, capturedAt, actor: me, source: "self");
        if (!granted) AppendConsent(tenantId, me, granted: true, source: "app", ip, recordedBy: null);
        Audit(tenantId, "face.enrolled", me, new { source = "self" });
        await db.SaveChangesAsync();
        await storage.DeleteAsync(oldPhoto);
        logger.LogInformation("Face enrolment saved for user {UserId} (tenant {TenantId}, self).", me, tenantId);
        return await GetMineAsync();
    }

    /// <summary>"Remove my face data": deletes the reference photo and kept selfies, and withdraws the consent.</summary>
    public async Task<MyFaceStatusResponse> RemoveMineAsync(string? ip)
    {
        var tenantId = currentUser.ResolveTenantId();
        var me = Me;
        var files = new List<string>();
        await FaceData.EraseAsync(db, tenantId, me, files, deleteAttempts: false);
        if (await Consents.IsGrantedAsync(db, tenantId, me, ConsentTypes.BiometricFace))
            AppendConsent(tenantId, me, granted: false, source: "app", ip, recordedBy: null);
        Audit(tenantId, "face.removed", me, new { by = "member", files = files.Count });
        await db.SaveChangesAsync();
        foreach (var f in files) await storage.DeleteAsync(f);
        return await GetMineAsync();
    }

    // ── Staff (member detail, attendance log) ────────────────────────────────

    public async Task<MemberFaceStatusResponse> GetMemberAsync(ulong memberId)
    {
        var (tenantId, _) = await MemberAsync(memberId);
        var settings = await AttendanceService.LoadSettingsAsync(db, tenantId);
        var e = await EnrollmentAsync(tenantId, memberId);
        string? enrolledBy = null;
        if (e?.EnrolledByUserId is { } by && by != memberId)
            enrolledBy = await db.Users.Where(u => u.Id == by).Select(u => (u.FirstName + " " + u.LastName).Trim()).FirstOrDefaultAsync();
        var attempts = await AttemptsQuery(tenantId).Where(a => a.UserId == memberId)
            .OrderByDescending(a => a.At).Take(10).ToListAsync();
        return new MemberFaceStatusResponse
        {
            UserId = memberId,
            FaceCheckEnabled = settings.FaceCheckEnabled,
            Enrolled = IsActive(e),
            Status = e?.Status,
            EnrolledAt = e?.EnrolledAt,
            Source = e?.Source,
            EnrolledByName = enrolledBy,
            ConsentGranted = await Consents.IsGrantedAsync(db, tenantId, memberId, ConsentTypes.BiometricFace),
            PhotoUrl = await SignAsync(e?.PhotoUrl),
            RecentAttempts = await MapAttemptsAsync(attempts),
            KeepCheckInSelfiesDays = settings.KeepCheckInSelfiesDays,
            FaceProvider = FaceProvider,
        };
    }

    /// <summary>
    /// Staff enrol a member at the desk with the same camera flow. <paramref name="consentConfirmed"/> =
    /// the member agreed in person (recorded as a "desk" consent with who recorded it).
    /// </summary>
    public async Task<MemberFaceStatusResponse> EnrollMemberAsync(ulong memberId, FileUpload photo, bool consentConfirmed, DateTime? capturedAt, string? ip)
    {
        var (tenantId, _) = await MemberAsync(memberId);
        var granted = await Consents.IsGrantedAsync(db, tenantId, memberId, ConsentTypes.BiometricFace);
        if (!granted && !consentConfirmed)
            throw new RuleException("The member must agree to face check-in first. Read them the consent text and confirm they agreed.",
                RuleException.UnprocessableStatus) { Code = FaceCheckCodes.ConsentRequired };

        var (_, oldPhoto) = await EnrollCoreAsync(tenantId, memberId, photo, capturedAt, actor: Me, source: "desk");
        if (!granted) AppendConsent(tenantId, memberId, granted: true, source: "desk", ip, recordedBy: Me);
        Audit(tenantId, "face.enrolled", memberId, new { source = "desk", replaced = oldPhoto is not null });
        await db.SaveChangesAsync();
        await storage.DeleteAsync(oldPhoto);
        logger.LogInformation("Face enrolment saved for user {UserId} (tenant {TenantId}) by staff {StaffId}.", memberId, tenantId, Me);
        return await GetMemberAsync(memberId);
    }

    /// <summary>Staff: deletes the reference photo and asks the member to enrol again at their next check-in.</summary>
    public async Task<MemberFaceStatusResponse> ResetMemberAsync(ulong memberId)
    {
        var (tenantId, _) = await MemberAsync(memberId);
        var e = await db.FaceEnrollments.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == memberId)
                ?? throw new KeyNotFoundException("This member hasn't enrolled for face check-in.");
        var old = e.PhotoUrl;
        e.PhotoUrl = null;
        e.Status = FaceEnrollmentStatuses.ResetRequired;
        Audit(tenantId, "face.reset", memberId, new { previousEnrolledAt = e.EnrolledAt });
        await db.SaveChangesAsync();
        await storage.DeleteAsync(old);
        return await GetMemberAsync(memberId);
    }

    /// <summary>Staff: deletes the enrolment and its photo (the member's consent record is left as it is).</summary>
    public async Task<bool> DeleteMemberAsync(ulong memberId)
    {
        var (tenantId, _) = await MemberAsync(memberId);
        var e = await db.FaceEnrollments.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == memberId);
        if (e is null) return false;
        var old = e.PhotoUrl;
        db.FaceEnrollments.Remove(e);
        Audit(tenantId, "face.deleted", memberId, new { previousEnrolledAt = e.EnrolledAt });
        await db.SaveChangesAsync();
        await storage.DeleteAsync(old);
        return true;
    }

    /// <summary>Face checks of the gym (failed ones by default), newest first; optionally one day (gym time) / branch.</summary>
    public async Task<PagedResponse<FaceAttemptResponse>> GetAttemptsAsync(DateOnly? date, ulong? branchId, bool failedOnly, int page, int size)
    {
        var tenantId = currentUser.ResolveTenantId();
        (page, size) = Paging.Clamp(page, size);
        var q = AttemptsQuery(tenantId);
        if (failedOnly) q = q.Where(a => a.Outcome != FaceAttemptOutcomes.Matched);
        if (date is { } d)
        {
            var from = (await TenantClock.ForAsync(db, tenantId)).StartOfDayUtc(d);
            q = q.Where(a => a.At >= from && a.At < from.AddDays(1));
        }
        if (branchId is { } b) q = q.Where(a => a.BranchId == b);
        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(a => a.At).Page(page, size).ToListAsync();
        return new PagedResponse<FaceAttemptResponse>
        {
            Items = await MapAttemptsAsync(rows), PageNumber = page, PageSize = size, TotalRecords = total,
        };
    }

    /// <summary>Staff: a kept selfie next to the member's reference photo (signed, short-lived links).</summary>
    public async Task<FaceAttemptPhotosResponse?> GetAttemptPhotosAsync(ulong attemptId)
    {
        var tenantId = currentUser.ResolveTenantId();
        var a = await AttemptsQuery(tenantId).FirstOrDefaultAsync(x => x.Id == attemptId);
        if (a is null) return null;
        var e = await EnrollmentAsync(tenantId, a.UserId);
        return new FaceAttemptPhotosResponse
        {
            AttemptId = a.Id, Outcome = a.Outcome, Similarity = a.Similarity, At = a.At,
            SelfieUrl = await SignAsync(a.SelfieUrl),
            ReferenceUrl = await SignAsync(e?.PhotoUrl),
        };
    }

    // ── Check-in (called by AttendanceService after location + gates passed) ──

    /// <summary>The member has an active reference photo and the consent stands.</summary>
    public async Task<bool> IsEnrolledAsync(ulong tenantId, ulong userId) =>
        IsActive(await EnrollmentAsync(tenantId, userId))
        && await Consents.IsGrantedAsync(db, tenantId, userId, ConsentTypes.BiometricFace);

    /// <summary>
    /// Compares the check-in selfie with the member's reference photo. Returns the match (the caller
    /// creates the visit and links the returned attempt); otherwise records the failed attempt and
    /// throws a <see cref="RuleException"/> with one of <see cref="FaceCheckCodes"/>.
    /// </summary>
    public async Task<FaceVerification> VerifyAsync(ulong tenantId, ulong userId, ulong branchId, FaceSelfie selfie, AttendanceSettings settings)
    {
        var enrollment = await EnrollmentAsync(tenantId, userId);
        if (!IsActive(enrollment) || !await Consents.IsGrantedAsync(db, tenantId, userId, ConsentTypes.BiometricFace))
            throw EnrollRequired();

        CheckCaptureTime(selfie.CapturedAt);
        var probe = await FaceImages.ReadAsync(selfie.Photo);
        var now = DateTime.UtcNow;
        var threshold = Math.Clamp(settings.FaceMatchThreshold, 80, 99);
        var attempt = new FaceCheckInAttempt
        {
            TenantId = tenantId, UserId = userId, BranchId = branchId, At = now, Threshold = threshold,
            CapturedAt = selfie.CapturedAt is { } c ? DateTime.SpecifyKind(c.ToUniversalTime(), DateTimeKind.Utc) : null,
        };

        // Attempt limit: after 3 mismatches in 10 minutes the face service isn't called again for a while.
        var since = now - MismatchWindow;
        var recentMismatches = await db.FaceCheckInAttempts
            .CountAsync(a => a.TenantId == tenantId && a.UserId == userId && a.Outcome == FaceAttemptOutcomes.Mismatch && a.At >= since);
        if (recentMismatches >= MaxMismatches)
        {
            attempt.Outcome = FaceAttemptOutcomes.Locked;
            await SaveFailedAsync(attempt);
            throw new RuleException(LockedMessage, RuleException.UnprocessableStatus) { Code = FaceCheckCodes.Locked };
        }

        if (!matcher.IsConfigured)
        {
            attempt.Outcome = FaceAttemptOutcomes.Unavailable;
            attempt.Detail = "not_configured";
            await SaveFailedAsync(attempt);
            throw Unavailable();
        }

        FaceMatchResult result;
        try
        {
            byte[] reference;
            await using (var stream = await storage.OpenReadAsync(enrollment!.PhotoUrl!))
            using (var ms = new MemoryStream())
            {
                await stream.CopyToAsync(ms);
                reference = ms.ToArray();
            }
            using var cts = new CancellationTokenSource(ServiceTimeout);
            result = await matcher.CompareAsync(new MemoryStream(reference, false), new MemoryStream(probe, false), cts.Token);
        }
        catch (Exception ex) when (ex is FaceServiceUnavailableException or OperationCanceledException or FileNotFoundException or HttpRequestException or IOException)
        {
            // Fail closed: never check in when the comparison couldn't run.
            logger.LogWarning("Face check unavailable for user {UserId} (tenant {TenantId}): {Error}", userId, tenantId, ex.GetType().Name);
            attempt.Outcome = FaceAttemptOutcomes.Unavailable;
            attempt.Detail = ex is OperationCanceledException ? "timeout" : ex is FileNotFoundException ? "reference_missing" : "service_error";
            await SaveFailedAsync(attempt);
            throw Unavailable();
        }

        if (!result.ReferenceFaceFound)
        {
            // The stored reference no longer yields a face (shouldn't happen: checked at enrolment). Ask to re-enrol.
            attempt.Outcome = FaceAttemptOutcomes.NotClear;
            attempt.Detail = "reference_no_face";
            await SaveFailedAsync(attempt);
            throw EnrollRequired("Your face check-in photo needs to be taken again.");
        }
        if (result.ProbeFaceCount != 1 || result.Similarity is null)
        {
            attempt.Outcome = FaceAttemptOutcomes.NotClear;
            attempt.Detail = result.Detail ?? (result.ProbeFaceCount == 0 ? "no_face" : "multiple_faces");
            await KeepSelfieAsync(attempt, probe, settings);
            await SaveFailedAsync(attempt);
            throw NotClear(result.ProbeFaceCount);
        }

        attempt.Similarity = Math.Round((decimal)result.Similarity.Value, 2);
        await KeepSelfieAsync(attempt, probe, settings);
        if (result.Similarity.Value < threshold)
        {
            attempt.Outcome = FaceAttemptOutcomes.Mismatch;
            await SaveFailedAsync(attempt);
            var left = Math.Max(0, MaxMismatches - recentMismatches - 1);
            // Nobody is notified; staff see the failed attempt in the attendance log.
            throw new RuleException(left > 0
                    ? $"Your selfie didn't match your face check-in photo. Try again in good light, facing the camera ({left} attempt{(left == 1 ? "" : "s")} left)."
                    : LockedMessage,
                RuleException.UnprocessableStatus)
            { Code = FaceCheckCodes.Mismatch, Payload = new { attemptsLeft = left } };
        }

        attempt.Outcome = FaceAttemptOutcomes.Matched;
        db.FaceCheckInAttempts.Add(attempt); // saved with the visit by the caller
        return new FaceVerification(attempt.Similarity.Value, attempt);
    }

    // ── Retention (daily job) ────────────────────────────────────────────────

    /// <summary>Deletes this gym's kept check-in selfies older than its <c>keepCheckInSelfiesDays</c> (all of them when 0).</summary>
    public static async Task<int> PurgeExpiredSelfiesAsync(IAppDbContext db, IFileStorage storage, ulong tenantId, DateTime now, CancellationToken ct = default)
    {
        var settings = await LoadSettingsAcrossTenantsAsync(db, tenantId);
        var cutoff = now.AddDays(-Math.Clamp(settings.KeepCheckInSelfiesDays, 0, 90));
        var expired = await db.FaceCheckInAttempts.AcrossTenants()
            .Where(a => a.TenantId == tenantId && a.SelfieUrl != null && a.At <= cutoff)
            .OrderBy(a => a.At).Take(500).ToListAsync(ct);
        var files = expired.Select(a => a.SelfieUrl!).ToList();
        foreach (var a in expired) a.SelfieUrl = null;
        await db.SaveChangesAsync(ct);
        foreach (var f in files) await storage.DeleteAsync(f);
        return expired.Count;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static async Task<AttendanceSettings> LoadSettingsAcrossTenantsAsync(IAppDbContext db, ulong tenantId)
    {
        var row = await db.TenantSettings.AcrossTenants().FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == AttendanceService.SettingKey);
        return row?.Value is null ? new AttendanceSettings()
            : row.Value.Deserialize<AttendanceSettings>(AttendanceService.Json) ?? new AttendanceSettings();
    }

    private async Task<(FaceEnrollment Enrollment, string? OldPhoto)> EnrollCoreAsync(
        ulong tenantId, ulong userId, FileUpload photo, DateTime? capturedAt, ulong actor, string source)
    {
        if (!PrivateStorageReady)
            throw RuleException.Unprocessable("Face photos need private file storage, which isn't set up on this server yet. Ask the gym to contact support.");
        if (!matcher.IsConfigured) throw Unavailable("Face check-in isn't available right now.");
        CheckCaptureTime(capturedAt);
        var bytes = await FaceImages.ReadAsync(photo);

        FaceDetectResult faces;
        try
        {
            using var cts = new CancellationTokenSource(ServiceTimeout);
            faces = await matcher.DetectAsync(new MemoryStream(bytes, false), cts.Token);
        }
        catch (Exception ex) when (ex is FaceServiceUnavailableException or OperationCanceledException)
        {
            logger.LogWarning("Face detection unavailable at enrolment for user {UserId}: {Error}", userId, ex.GetType().Name);
            throw Unavailable("Face check-in isn't available right now. Please try again later.");
        }
        if (faces.FaceCount != 1 || faces.ClearFaceCount != 1)
            throw NotClear(faces.FaceCount, enrolling: true);

        var url = await storage.SaveAsync(FileUpload.FromBytes("face" + (FaceImages.ContentTypeOf(bytes) == "image/png" ? ".png" : ".jpg"),
            FaceImages.ContentTypeOf(bytes), bytes), Folder(tenantId, userId), FileKind.FaceImage);

        var e = await db.FaceEnrollments.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId);
        var old = e?.PhotoUrl;
        if (e is null)
        {
            e = new FaceEnrollment { TenantId = tenantId, UserId = userId };
            db.FaceEnrollments.Add(e);
        }
        e.PhotoUrl = url;
        e.Status = FaceEnrollmentStatuses.Active;
        e.EnrolledAt = DateTime.UtcNow;
        e.EnrolledByUserId = actor;
        e.Source = source;
        return (e, old);
    }

    /// <summary>
    /// Not under "tenant-{id}/" or "tenants/{id}/": the generic signed-url endpoint (open to every member
    /// of the gym) refuses these paths. Face photos are only signed by this service, for the member or staff.
    /// </summary>
    private static string Folder(ulong tenantId, ulong userId) => $"face-checkin/t{tenantId}/u{userId}";

    /// <summary>Keeps the check-in selfie for staff review when the gym keeps them (best effort; never blocks a check-in).</summary>
    private async Task KeepSelfieAsync(FaceCheckInAttempt attempt, byte[] probe, AttendanceSettings settings)
    {
        if (settings.KeepCheckInSelfiesDays <= 0 || !PrivateStorageReady) return;
        try
        {
            attempt.SelfieUrl = await storage.SaveAsync(FileUpload.FromBytes("selfie.jpg", FaceImages.ContentTypeOf(probe), probe),
                Folder(attempt.TenantId, attempt.UserId) + "/checkins", FileKind.FaceImage);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("Could not keep a check-in selfie for user {UserId}: {Error}", attempt.UserId, ex.GetType().Name);
        }
    }

    private async Task SaveFailedAsync(FaceCheckInAttempt attempt)
    {
        db.FaceCheckInAttempts.Add(attempt);
        await db.SaveChangesAsync();
    }

    private static void CheckCaptureTime(DateTime? capturedAt)
    {
        if (capturedAt is not { } c) return;
        var at = c.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(c, DateTimeKind.Utc) : c.ToUniversalTime();
        var now = DateTime.UtcNow;
        if (at < now - MaxCaptureAge || at > now + MaxClockSkew)
            throw new ArgumentException("This selfie is too old. Take a new one with the camera.");
    }

    private Task<FaceEnrollment?> EnrollmentAsync(ulong tenantId, ulong userId) =>
        db.FaceEnrollments.AsNoTracking().FirstOrDefaultAsync(x => x.TenantId == tenantId && x.UserId == userId);

    private static bool IsActive(FaceEnrollment? e) =>
        e is { Status: FaceEnrollmentStatuses.Active, PhotoUrl: not null };

    private IQueryable<FaceCheckInAttempt> AttemptsQuery(ulong tenantId) =>
        db.FaceCheckInAttempts.AsNoTracking().Where(a => a.TenantId == tenantId);

    /// <summary>The member, in the caller's gym (tenant filter) and not deleted.</summary>
    private async Task<(ulong TenantId, Domain.Entities.Identity.User User)> MemberAsync(ulong memberId)
    {
        var tenantId = currentUser.ResolveTenantId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == memberId && u.TenantId == tenantId && u.DeletedAt == null)
                   ?? throw new KeyNotFoundException($"Member {memberId} not found.");
        return (tenantId, user);
    }

    private async Task<List<FaceAttemptResponse>> MapAttemptsAsync(List<FaceCheckInAttempt> rows)
    {
        var userIds = rows.Select(r => r.UserId).Distinct().ToList();
        var branchIds = rows.Where(r => r.BranchId.HasValue).Select(r => r.BranchId!.Value).Distinct().ToList();
        var names = await db.Users.Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() }).ToDictionaryAsync(u => u.Id, u => u.Name);
        var branches = await db.Branches.Where(b => branchIds.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
        return rows.Select(r => new FaceAttemptResponse
        {
            Id = r.Id, UserId = r.UserId, UserName = names.GetValueOrDefault(r.UserId),
            BranchId = r.BranchId, BranchName = r.BranchId is { } b ? branches.GetValueOrDefault(b) : null,
            At = r.At, Outcome = r.Outcome, Similarity = r.Similarity, Threshold = r.Threshold, Detail = r.Detail,
            HasSelfie = r.SelfieUrl is not null, AttendanceId = r.AttendanceId,
        }).ToList();
    }

    private async Task<string?> SignAsync(string? url)
    {
        if (url is null) return null;
        try { return await storage.GetSignedUrlAsync(url); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("Could not sign a face photo link: {Error}", ex.GetType().Name);
            return null;
        }
    }

    private void AppendConsent(ulong tenantId, ulong userId, bool granted, string source, string? ip, ulong? recordedBy) =>
        db.ConsentRecords.Add(new ConsentRecord
        {
            TenantId = tenantId, UserId = userId, Type = ConsentTypes.BiometricFace, Granted = granted, Version = ConsentVersion,
            At = DateTime.UtcNow, Source = source, Ip = ip is { Length: > 64 } ? ip[..64] : ip, RecordedByUserId = recordedBy,
        });

    private void Audit(ulong tenantId, string action, ulong memberId, object details) =>
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId, UserId = currentUser.UserId, Action = action, EntityType = "FaceEnrollment", EntityId = memberId,
            NewValues = JsonSerializer.SerializeToDocument(details), CreatedAt = DateTime.UtcNow,
        });

    private static RuleException EnrollRequired(string? message = null) =>
        new(message ?? "Set up face check-in first: take a reference selfie.", RuleException.UnprocessableStatus)
            { Code = FaceCheckCodes.EnrollRequired };

    private static RuleException Unavailable(string message = UnavailableMessage) =>
        new(message, 503) { Code = FaceCheckCodes.Unavailable };

    private static RuleException NotClear(int faceCount, bool enrolling = false) =>
        new(faceCount switch
            {
                0 => "We couldn't see a face. Hold the phone at eye level, in good light, and try again.",
                > 1 => "More than one face is in the photo. Make sure only you are in the picture and try again.",
                _ => enrolling
                    ? "Your face isn't clear enough for a reference photo. Face the camera in good light, remove sunglasses or a mask, and try again."
                    : "Your face isn't clear. Face the camera in good light and try again.",
            }, RuleException.UnprocessableStatus)
        { Code = FaceCheckCodes.NotClear, Payload = new { faceCount } };
}

/// <summary>Deletes a member's face data (privacy anonymisation, consent withdrawal, "remove my face data").</summary>
public static class FaceData
{
    /// <summary>
    /// Removes the enrolment (and collects its photo), clears kept selfies (collected into
    /// <paramref name="files"/> for deletion after commit). With <paramref name="deleteAttempts"/> the
    /// attempt rows go too (anonymisation); otherwise they stay as image-free history. Does not save.
    /// </summary>
    public static async Task<int> EraseAsync(IAppDbContext db, ulong tenantId, ulong userId, List<string> files, bool deleteAttempts)
    {
        var count = 0;
        var enrollments = await db.FaceEnrollments.AcrossTenants().Where(e => e.TenantId == tenantId && e.UserId == userId).ToListAsync();
        files.AddRange(enrollments.Where(e => e.PhotoUrl != null).Select(e => e.PhotoUrl!));
        db.FaceEnrollments.RemoveRange(enrollments);
        count += enrollments.Count;

        var attempts = await db.FaceCheckInAttempts.AcrossTenants()
            .Where(a => a.TenantId == tenantId && a.UserId == userId && (deleteAttempts || a.SelfieUrl != null)).ToListAsync();
        files.AddRange(attempts.Where(a => a.SelfieUrl != null).Select(a => a.SelfieUrl!));
        if (deleteAttempts) db.FaceCheckInAttempts.RemoveRange(attempts);
        else foreach (var a in attempts) a.SelfieUrl = null;
        count += attempts.Count;
        return count;
    }
}

/// <summary>Withdrawing the "biometric_face" consent deletes the reference photo and kept selfies.</summary>
public class FaceConsentWithdrawalHandler(IAppDbContext db, IFileStorage storage) : IConsentWithdrawalHandler
{
    public string Type => ConsentTypes.BiometricFace;

    public async Task OnWithdrawnAsync(ulong tenantId, ulong userId)
    {
        var files = new List<string>();
        var n = await FaceData.EraseAsync(db, tenantId, userId, files, deleteAttempts: false);
        if (n == 0) return;
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId, UserId = userId, Action = "face.removed", EntityType = "FaceEnrollment", EntityId = userId,
            NewValues = JsonSerializer.SerializeToDocument(new { by = "consent_withdrawal", files = files.Count }), CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        foreach (var f in files) await storage.DeleteAsync(f);
    }
}
