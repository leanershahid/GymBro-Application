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
    public short? DurationMin { get; set; }  // generated column, read-only
    public AttendanceMethod Method { get; set; } = AttendanceMethod.Qr;
    public string? GateDevice { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch Branch { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
