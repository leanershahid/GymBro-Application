namespace GymManagmentApplication.Domain.Entities.Health;

public class ClientGoal : BaseEntity
{
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
