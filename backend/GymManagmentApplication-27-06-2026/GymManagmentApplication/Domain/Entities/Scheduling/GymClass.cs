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

    // ── Invariants (ARCH-084). Methods, not properties, so the EF model is unchanged. ──

    /// <summary>True when a capacity is set and the booked (not waitlisted) seats have reached it.</summary>
    public bool IsFull() => MaxCapacity is { } cap && Bookings.Count(b => b.Status == BookingStatus.Booked) >= cap;

    /// <summary>Keeps the denormalised counters in step with the loaded <see cref="Bookings"/>.</summary>
    public void RecountBookings()
    {
        EnrolledCount = (short)Bookings.Count(b => b.Status is BookingStatus.Booked or BookingStatus.Attended);
        WaitlistCount = (short)Bookings.Count(b => b.Status == BookingStatus.Waitlisted);
    }
}
