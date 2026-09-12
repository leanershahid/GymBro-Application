using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class SupportTicketReply
{
    public ulong Id { get; set; }
    public ulong TicketId { get; set; }
    public ulong UserId { get; set; }
    public string Body { get; set; } = default!;
    public bool IsInternal { get; set; }
    public JsonDocument? Attachments { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public SupportTicket Ticket { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
