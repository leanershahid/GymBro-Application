using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class UiTheme : BaseEntity
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public bool IsActive { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? FontHeading { get; set; }
    public string? FontBody { get; set; }
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? CustomCss { get; set; }
    public JsonDocument? LayoutConfig { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
