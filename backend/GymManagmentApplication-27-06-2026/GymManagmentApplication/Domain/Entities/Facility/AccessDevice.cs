using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Facility;

public class AccessDevice
{
    public ulong Id { get; set; }
    public ulong BranchId { get; set; }
    public string Name { get; set; } = default!;
    public AccessDeviceType Type { get; set; }
    public string? Location { get; set; }
    public string DeviceUid { get; set; } = default!;
    public bool IsOnline { get; set; } = true;
    public DateTime? LastPing { get; set; }

    public Core.Branch Branch { get; set; } = default!;
    public ICollection<AccessEvent> Events { get; set; } = [];
}
