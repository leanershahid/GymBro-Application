using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class SupportTicket : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong? AssignedTo { get; set; }
    public string Subject { get; set; } = default!;
    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.Open;
    public SupportPriority Priority { get; set; } = SupportPriority.Medium;
    public string? Category { get; set; }
    public bool AiRouted { get; set; }
    public DateTime? ResolvedAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
    public Identity.User? AssignedUser { get; set; }
    public ICollection<SupportTicketReply> Replies { get; set; } = [];
}
