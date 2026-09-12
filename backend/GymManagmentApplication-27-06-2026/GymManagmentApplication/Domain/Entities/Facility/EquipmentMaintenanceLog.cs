using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class EquipmentMaintenanceLog
{
    public ulong Id { get; set; }
    public ulong EquipmentId { get; set; }
    public ulong? PerformedBy { get; set; }
    public MaintenanceType Type { get; set; }
    public string? Description { get; set; }
    public decimal? Cost { get; set; }
    public DateTime PerformedAt { get; set; }
    public DateOnly? NextDue { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public FacilityEquipment Equipment { get; set; } = default!;
    public Identity.User? Performer { get; set; }
}
