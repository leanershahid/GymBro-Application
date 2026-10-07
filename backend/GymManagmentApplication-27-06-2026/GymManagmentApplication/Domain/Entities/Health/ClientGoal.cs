namespace GymManagmentApplication.Domain.Entities.Health;

public class ClientGoal : BaseEntity
{
    /// <summary>Owning gym (nullable: rows written before this was mapped have none).</summary>
    public ulong? TenantId { get; set; }
    public ulong ClientId { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public Enums.GoalType Type { get; set; } = Enums.GoalType.Custom;
    public decimal? TargetValue { get; set; }
    public decimal CurrentValue { get; set; }
    public string? Unit { get; set; }
    public DateOnly? TargetDate { get; set; }
    public Enums.GoalStatus Status { get; set; } = Enums.GoalStatus.Active;

    public Identity.User Client { get; set; } = default!;
}
