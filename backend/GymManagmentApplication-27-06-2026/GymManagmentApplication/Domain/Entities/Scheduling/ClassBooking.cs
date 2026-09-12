using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Scheduling;

public class ClassBooking
{
    public ulong Id { get; set; }
    public ulong ClassId { get; set; }
    public ulong ClientId { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Booked;
    public DateTime BookedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CancelledAt { get; set; }

    public GymClass Class { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
}
