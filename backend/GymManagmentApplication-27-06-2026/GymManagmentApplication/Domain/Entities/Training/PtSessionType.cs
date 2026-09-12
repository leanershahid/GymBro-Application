using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class PtSessionType
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong TrainerId { get; set; }
    public string Name { get; set; } = default!;
    public short DurationMin { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = "USD";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
    public TrainerProfile Trainer { get; set; } = default!;
    public ICollection<PtSession> Sessions { get; set; } = [];
}
