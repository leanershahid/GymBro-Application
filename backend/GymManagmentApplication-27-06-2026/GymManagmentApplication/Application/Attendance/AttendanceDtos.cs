namespace GymManagmentApplication.Application.Attendance;

/// <summary>Per-gym attendance settings (stored as TenantSetting "attendance").</summary>
public class AttendanceSettings
{
    /// <summary>Face scan at an access device records attendance.</summary>
    public bool FaceEnabled { get; set; } = true;
    /// <summary>Fingerprint at an access device records attendance.</summary>
    public bool FingerprintEnabled { get; set; } = true;
    // Location check-in is switched on per branch (Branch.LocationCheckInEnabled).
    /// <summary>Radius used for a branch that has coordinates but no radius of its own.</summary>
    public int DefaultRadiusM { get; set; } = 100;
    /// <summary>Reject fixes less precise than this (metres) — a 2 km GPS guess can't prove presence.</summary>
    public int MaxAccuracyM { get; set; } = 150;

    // ── Face check-in (self check-in only; front desk is unchanged) ──
    /// <summary>Members' self check-in needs location AND a live selfie matching their reference photo. Off by default.</summary>
    public bool FaceCheckEnabled { get; set; }
    /// <summary>Minimum similarity (80–99) for a selfie to count as a match.</summary>
    public int FaceMatchThreshold { get; set; } = 90;
    /// <summary>Days to keep check-in selfies for staff review (0–90; 0 = don't keep them).</summary>
    public int KeepCheckInSelfiesDays { get; set; } = 30;
}

public class BranchGeofenceResponse
{
    public ulong BranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? City { get; set; }
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    /// <summary>Effective radius (branch's own or the gym default); null when the branch has no coordinates.</summary>
    public int? RadiusM { get; set; }
    public bool HasOwnRadius { get; set; }
    /// <summary>Location check-in switched on for this branch.</summary>
    public bool Enabled { get; set; }
    public bool IsConfigured => Lat.HasValue && Lng.HasValue;
    /// <summary>Members can actually check in here: switched on and has a location.</summary>
    public bool IsActive => Enabled && IsConfigured;
}

public class AttendanceSettingsResponse
{
    public AttendanceSettings Settings { get; set; } = new();
    /// <summary>Read-only: a face service (AWS Rekognition) is configured on the server; face check-in can be turned on.</summary>
    public bool FaceServiceConfigured { get; set; }
    /// <summary>Read-only: "local" (FaceAiSharp on this server), "aws" (AWS Rekognition) or "none".</summary>
    public string FaceProvider { get; set; } = "none";
    /// <summary>Read-only: face photos can be stored privately (Cloudinary / Supabase, or a development server).</summary>
    public bool PrivateStorageConfigured { get; set; }
    public List<BranchGeofenceResponse> Branches { get; set; } = [];
}

public class SetBranchGeofenceRequest
{
    /// <summary>Allow location check-in at this branch.</summary>
    public bool Enabled { get; set; } = true;
    /// <summary>Required when enabling; may be omitted to just switch an existing location off.</summary>
    public decimal? Lat { get; set; }
    public decimal? Lng { get; set; }
    /// <summary>Null = use the gym default radius.</summary>
    public int? RadiusM { get; set; }
}

public class LocationCheckRequest
{
    public double Lat { get; set; }
    public double Lng { get; set; }
    /// <summary>Reported GPS accuracy in metres (from the device).</summary>
    public double? AccuracyM { get; set; }
    /// <summary>Optional: which branch the member says they're at; otherwise the nearest one.</summary>
    public ulong? BranchId { get; set; }
}

public class AttendanceRecordResponse
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string? UserName { get; set; }
    public ulong BranchId { get; set; }
    public string? BranchName { get; set; }
    public string Method { get; set; } = default!;
    public DateTime CheckInAt { get; set; }
    public DateTime? CheckOutAt { get; set; }
    public short? DurationMin { get; set; }
    public int? DistanceM { get; set; }
    /// <summary>Self check-in with face check: true = the selfie matched (null = no face check).</summary>
    public bool? FaceVerified { get; set; }
    /// <summary>Similarity 0–100 of the matching selfie.</summary>
    public decimal? FaceScore { get; set; }
    /// <summary>The face check behind this visit (staff can open its kept selfie next to the reference photo).</summary>
    public ulong? FaceAttemptId { get; set; }
    public bool HasFaceSelfie { get; set; }
}

public class MyAttendanceStatusResponse
{
    /// <summary>True when at least one branch of the gym accepts location check-in.</summary>
    public bool LocationEnabled { get; set; }
    /// <summary>The open (not yet checked-out) visit, if any.</summary>
    public AttendanceRecordResponse? OpenVisit { get; set; }
    /// <summary>Branches the caller can check in at (configured geofences only).</summary>
    public List<BranchGeofenceResponse> Branches { get; set; } = [];
    public int VisitsThisMonth { get; set; }
    /// <summary>Self check-in also needs a live selfie that matches the member's reference photo.</summary>
    public bool FaceCheckRequired { get; set; }
    /// <summary>The member has an active reference photo (when false and face check is on, check-in opens enrolment).</summary>
    public bool FaceEnrolled { get; set; }
}

public class CheckInResultResponse
{
    public bool CheckedIn { get; set; }
    public string Message { get; set; } = default!;
    public AttendanceRecordResponse? Visit { get; set; }
    /// <summary>Distance to the nearest configured branch (metres), for "you're 340 m away" feedback.</summary>
    public int? DistanceM { get; set; }
    public string? NearestBranch { get; set; }
    /// <summary>Desk check-in stopped by the safety gate (missing waiver / health check); retry with override.</summary>
    public bool SafetyBlocked { get; set; }
    /// <summary>What the safety gate found missing (waiver, health, health_expired, clearance, emergency_contact).</summary>
    public List<string>? SafetyMissing { get; set; }
    /// <summary>
    /// Location passed, and the gym needs a selfie too: send it to POST api/attendance/check-in/face
    /// (multipart: the same location fields + selfie + capturedAt).
    /// </summary>
    public bool FaceRequired { get; set; }
}
