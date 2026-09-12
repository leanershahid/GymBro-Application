using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class SocialPost
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public string? Content { get; set; }
    public JsonDocument? Media { get; set; }
    public Enums.SocialPostType PostType { get; set; } = Enums.SocialPostType.General;
    public ulong? RefId { get; set; }
    public uint LikesCount { get; set; }
    public bool IsVisible { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
