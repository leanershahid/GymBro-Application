using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class Locker
{
    public ulong Id { get; set; }
    /// <summary>Owning gym (nullable: rows written before this was mapped have none).</summary>
    public ulong? TenantId { get; set; }
    public ulong BranchId { get; set; }
    public string Number { get; set; } = default!;
    public string? Zone { get; set; }
    public LockerStatus Status { get; set; } = LockerStatus.Available;

    public Core.Branch Branch { get; set; } = default!;
    public ICollection<LockerAssignment> Assignments { get; set; } = [];
}
