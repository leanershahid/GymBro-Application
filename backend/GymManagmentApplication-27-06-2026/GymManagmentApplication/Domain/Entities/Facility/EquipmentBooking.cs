using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class EquipmentBooking
{
    public ulong Id { get; set; }
    public ulong EquipmentId { get; set; }
    public ulong UserId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public EquipmentBookingStatus Status { get; set; } = EquipmentBookingStatus.Reserved;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FacilityEquipment Equipment { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
