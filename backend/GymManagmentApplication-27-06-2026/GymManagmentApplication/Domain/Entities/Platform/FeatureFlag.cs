using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class FeatureFlag
{
    public ulong Id { get; set; }
    public string FeatureKey { get; set; } = default!;
    public string? Label { get; set; }
    public string? Description { get; set; }
    public JsonDocument? Plans { get; set; }
}
