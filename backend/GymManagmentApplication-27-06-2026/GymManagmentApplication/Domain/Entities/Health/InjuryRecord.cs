namespace GymManagmentApplication.Domain.Entities.Health;

public class InjuryRecord : BaseEntity
{
    public ulong ClientId { get; set; }
    public ulong? ReportedBy { get; set; }
    public string BodyPart { get; set; } = default!;
    public string? InjuryType { get; set; }
    public Enums.InjurySeverity Severity { get; set; } = Enums.InjurySeverity.Minor;
    public DateOnly? OccurredAt { get; set; }
    public DateOnly? RecoveredAt { get; set; }
    public string? Notes { get; set; }
    public bool AiDetected { get; set; }
    public System.Text.Json.JsonDocument? Restrictions { get; set; }

    public Identity.User Client { get; set; } = default!;
    public Identity.User? Reporter { get; set; }
}
