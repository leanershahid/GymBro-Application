using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class CustomPage : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Title { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Content { get; set; }
    public JsonDocument? Layout { get; set; }
    public bool IsPublished { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDesc { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
