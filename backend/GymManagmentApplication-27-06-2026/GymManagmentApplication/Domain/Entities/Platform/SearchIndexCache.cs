using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class SearchIndexCache
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string EntityType { get; set; } = default!;
    public ulong EntityId { get; set; }
    public string SearchText { get; set; } = default!;
    public JsonDocument? Embedding { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
