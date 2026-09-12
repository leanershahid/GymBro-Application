using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.CRM;

public class LeadActivity
{
    public ulong Id { get; set; }
    public ulong LeadId { get; set; }
    public ulong? UserId { get; set; }
    public LeadActivityType Type { get; set; }
    public string? Description { get; set; }
    public string? Outcome { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Lead Lead { get; set; } = default!;
}
