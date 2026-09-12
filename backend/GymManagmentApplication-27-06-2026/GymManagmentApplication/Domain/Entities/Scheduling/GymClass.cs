using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Scheduling;

public class GymClass
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public ulong ClassTypeId { get; set; }
    public ulong? TrainerId { get; set; }
    public string? Title { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public short? MaxCapacity { get; set; }
    public short EnrolledCount { get; set; }
    public short WaitlistCount { get; set; }
    public ClassStatus Status { get; set; } = ClassStatus.Scheduled;
    public string? RecurrenceRule { get; set; }
    public ulong? RecurrenceId { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch Branch { get; set; } = default!;
    public ClassType ClassType { get; set; } = default!;
    public Training.TrainerProfile? Trainer { get; set; }
    public ICollection<ClassBooking> Bookings { get; set; } = [];
}
