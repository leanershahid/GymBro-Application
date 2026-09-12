using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class Locker
{
    public ulong Id { get; set; }
    public ulong BranchId { get; set; }
    public string Number { get; set; } = default!;
    public string? Zone { get; set; }
    public LockerStatus Status { get; set; } = LockerStatus.Available;

    public Core.Branch Branch { get; set; } = default!;
    public ICollection<LockerAssignment> Assignments { get; set; } = [];
}
