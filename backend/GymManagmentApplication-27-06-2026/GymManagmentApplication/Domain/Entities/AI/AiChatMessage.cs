using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.AI;

public class AiChatMessage
{
    public ulong Id { get; set; }
    public ulong SessionId { get; set; }
    public AiChatRole Role { get; set; }
    public string Content { get; set; } = default!;
    public ushort? Tokens { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public AiChatSession Session { get; set; } = default!;
}
