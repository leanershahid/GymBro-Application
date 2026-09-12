using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class FacilityEquipment : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong BranchId { get; set; }
    public ushort? EquipmentId { get; set; }
    public string Name { get; set; } = default!;
    public string? SerialNumber { get; set; }
    public DateOnly? PurchaseDate { get; set; }
    public DateOnly? WarrantyExpiry { get; set; }
    public FacilityEquipmentStatus Status { get; set; } = FacilityEquipmentStatus.Operational;
    public string? LocationTag { get; set; }
    public string? IotDeviceId { get; set; }
    public DateOnly? LastServiced { get; set; }
    public DateOnly? NextService { get; set; }
    public string? Notes { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Core.Branch Branch { get; set; } = default!;
    public Training.Equipment? Equipment { get; set; }
    public ICollection<EquipmentMaintenanceLog> MaintenanceLogs { get; set; } = [];
    public ICollection<EquipmentBooking> Bookings { get; set; } = [];
}
