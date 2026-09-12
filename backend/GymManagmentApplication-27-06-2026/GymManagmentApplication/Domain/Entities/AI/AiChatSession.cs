using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.AI;

public class AiChatSession
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public ulong TenantId { get; set; }
    public string SessionKey { get; set; } = default!;
    public JsonDocument? Context { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }

    public Identity.User User { get; set; } = default!;
    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<AiChatMessage> Messages { get; set; } = [];
}
