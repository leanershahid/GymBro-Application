using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Application.Attendance.Face;

/// <summary>A live selfie sent with a self check-in.</summary>
/// <param name="Photo">JPEG/PNG, at most 5 MB.</param>
/// <param name="CapturedAt">When the app captured it (UTC); stale or future timestamps are refused.</param>
public sealed record FaceSelfie(FileUpload Photo, DateTime? CapturedAt);

/// <summary>A selfie that matched: written onto the visit.</summary>
public sealed record FaceVerification(decimal Score, Domain.Entities.Scheduling.FaceCheckInAttempt Attempt);

/// <summary>The member's own face check-in state (Profile → Face check-in, and the check-in card).</summary>
public class MyFaceStatusResponse
{
    /// <summary>The gym has face check-in on: self check-in needs location AND a matching selfie.</summary>
    public bool Required { get; set; }
    /// <summary>A reference photo is on file and active.</summary>
    public bool Enrolled { get; set; }
    /// <summary>active, reset_required, or null when never enrolled.</summary>
    public string? Status { get; set; }
    public DateTime? EnrolledAt { get; set; }
    /// <summary>self or desk.</summary>
    public string? Source { get; set; }
    /// <summary>Current state of the "biometric_face" consent.</summary>
    public bool ConsentGranted { get; set; }
    /// <summary>Short-lived link to the member's own reference photo.</summary>
    public string? PhotoUrl { get; set; }
    /// <summary>Gym's selfie retention in days (0 = check-in selfies aren't kept), for the consent text.</summary>
    public int KeepCheckInSelfiesDays { get; set; }
    /// <summary>Where faces are compared: "local" (this server), "aws" (AWS Rekognition) or "none".</summary>
    public string FaceProvider { get; set; } = "none";
}

public class FaceAttemptResponse
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string? UserName { get; set; }
    public ulong? BranchId { get; set; }
    public string? BranchName { get; set; }
    public DateTime At { get; set; }
    public string Outcome { get; set; } = default!;
    public decimal? Similarity { get; set; }
    public int Threshold { get; set; }
    public string? Detail { get; set; }
    public bool HasSelfie { get; set; }
    public ulong? AttendanceId { get; set; }
}

/// <summary>Staff view of a member's face check-in (member detail).</summary>
public class MemberFaceStatusResponse
{
    public ulong UserId { get; set; }
    public bool FaceCheckEnabled { get; set; }
    public bool Enrolled { get; set; }
    public string? Status { get; set; }
    public DateTime? EnrolledAt { get; set; }
    public string? Source { get; set; }
    public string? EnrolledByName { get; set; }
    public bool ConsentGranted { get; set; }
    /// <summary>Signed, short-lived link to the reference photo.</summary>
    public string? PhotoUrl { get; set; }
    public List<FaceAttemptResponse> RecentAttempts { get; set; } = [];
    /// <summary>Gym's selfie retention in days, for the consent text read out at the desk.</summary>
    public int KeepCheckInSelfiesDays { get; set; }
    public string FaceProvider { get; set; } = "none";
}

/// <summary>A kept check-in selfie next to the reference photo (both signed, short-lived).</summary>
public class FaceAttemptPhotosResponse
{
    public ulong AttemptId { get; set; }
    public string? SelfieUrl { get; set; }
    public string? ReferenceUrl { get; set; }
    public decimal? Similarity { get; set; }
    public string Outcome { get; set; } = default!;
    public DateTime At { get; set; }
}
