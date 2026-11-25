namespace GymManagmentApplication.Domain.Entities.Scheduling;

// Face verification for self check-in (optional per gym, attendance settings "faceCheckEnabled").
// Mapping: Infrastructure/Data/Configurations/FaceCheckInConfigurations.cs.

public static class FaceEnrollmentStatuses
{
    /// <summary>A reference photo is on file and is used at check-in.</summary>
    public const string Active = "active";
    /// <summary>Staff reset the enrolment: the photo was deleted and the member must enrol again.</summary>
    public const string ResetRequired = "reset_required";
}

/// <summary>
/// A member's reference selfie for face check-in (one per member and gym). The photo is stored
/// privately (signed URLs only) and is deleted when the member removes it, withdraws the
/// "biometric_face" consent, or their account is anonymised.
/// </summary>
public class FaceEnrollment : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>Private storage URL of the reference photo; null after a reset.</summary>
    public string? PhotoUrl { get; set; }
    /// <summary>One of <see cref="FaceEnrollmentStatuses"/>.</summary>
    public string Status { get; set; } = FaceEnrollmentStatuses.Active;
    public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
    /// <summary>Who captured the photo: the member themself, or a staff member at the desk.</summary>
    public ulong? EnrolledByUserId { get; set; }
    /// <summary>"self" (app) or "desk" (staff).</summary>
    public string Source { get; set; } = "self";
}

public static class FaceAttemptOutcomes
{
    public const string Matched = "matched";
    public const string Mismatch = "mismatch";
    /// <summary>No face, several faces, or an unusable image.</summary>
    public const string NotClear = "not_clear";
    /// <summary>The face service failed or timed out; nobody was checked in.</summary>
    public const string Unavailable = "unavailable";
    /// <summary>Too many mismatches in a short time; the face service was not called.</summary>
    public const string Locked = "locked";
}

/// <summary>
/// One face check at self check-in, successful or not. Failed attempts are shown to staff in the
/// attendance log. The selfie is kept only when the gym keeps check-in selfies (and only for that
/// many days; a daily job deletes older ones).
/// </summary>
public class FaceCheckInAttempt
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong? BranchId { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    /// <summary>One of <see cref="FaceAttemptOutcomes"/>.</summary>
    public string Outcome { get; set; } = default!;
    /// <summary>Similarity 0–100 reported by the face service (null when no comparison ran).</summary>
    public decimal? Similarity { get; set; }
    /// <summary>The gym's threshold at the time.</summary>
    public int Threshold { get; set; }
    /// <summary>Short machine detail: no_face, multiple_faces, invalid_image, timeout…</summary>
    public string? Detail { get; set; }
    /// <summary>When the app says the selfie was taken (live capture only).</summary>
    public DateTime? CapturedAt { get; set; }
    /// <summary>Private storage URL of the selfie, when kept; null once deleted.</summary>
    public string? SelfieUrl { get; set; }
    /// <summary>The visit this check created (matched attempts only).</summary>
    public ulong? AttendanceId { get; set; }
}
