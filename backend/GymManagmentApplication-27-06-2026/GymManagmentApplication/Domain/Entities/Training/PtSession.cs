using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Training;

public class PtSession : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public ulong SessionTypeId { get; set; }
    public ulong TrainerId { get; set; }
    public ulong ClientId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public PtSessionStatus Status { get; set; } = PtSessionStatus.Booked;
    public decimal? Price { get; set; }
    public string? Notes { get; set; }
    public string? TrainerNotes { get; set; }
    public byte? Rating { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public PtSessionType SessionType { get; set; } = default!;
    public TrainerProfile Trainer { get; set; } = default!;
    public Identity.User Client { get; set; } = default!;
}
