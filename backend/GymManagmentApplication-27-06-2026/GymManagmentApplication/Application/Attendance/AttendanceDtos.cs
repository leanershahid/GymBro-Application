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
}

public class CheckInResultResponse
{
    public bool CheckedIn { get; set; }
    public string Message { get; set; } = default!;
    public AttendanceRecordResponse? Visit { get; set; }
    /// <summary>Distance to the nearest configured branch (metres), for "you're 340 m away" feedback.</summary>
    public int? DistanceM { get; set; }
    public string? NearestBranch { get; set; }
}
