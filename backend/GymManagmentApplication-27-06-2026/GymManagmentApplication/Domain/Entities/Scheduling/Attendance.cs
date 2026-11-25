using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Scheduling;

public class Attendance
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public ulong UserId { get; set; }
    public DateTime CheckInAt { get; set; }
    public DateTime? CheckOutAt { get; set; }
    public short? DurationMin { get; set; }  // set at check-out
    /// <summary>Where a location check-in was made, and how far it was from the branch.</summary>
    public decimal? CheckInLat { get; set; }
    public decimal? CheckInLng { get; set; }
    public int? CheckInDistanceM { get; set; }
    public AttendanceMethod Method { get; set; } = AttendanceMethod.Qr;
    public string? GateDevice { get; set; }
    /// <summary>Self check-in with face verification: true when the selfie matched (null = no face check).</summary>
    public bool? FaceVerified { get; set; }
    /// <summary>Similarity 0–100 of the matching selfie.</summary>
    public decimal? FaceScore { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch Branch { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
