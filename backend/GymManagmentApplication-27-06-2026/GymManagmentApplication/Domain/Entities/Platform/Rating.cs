namespace GymManagmentApplication.Domain.Entities.Platform;

public class Rating
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ReviewerId { get; set; }
    public string EntityType { get; set; } = default!;
    public ulong EntityId { get; set; }
    public byte Score { get; set; }
    public string? Review { get; set; }
    public bool IsPublic { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User Reviewer { get; set; } = default!;
}
