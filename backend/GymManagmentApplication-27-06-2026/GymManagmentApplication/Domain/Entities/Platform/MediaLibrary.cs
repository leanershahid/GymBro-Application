using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class MediaLibrary
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? UploadedBy { get; set; }
    public string Name { get; set; } = default!;
    public string FileUrl { get; set; } = default!;
    public string? FileType { get; set; }
    public string? MimeType { get; set; }
    public uint? FileSize { get; set; }
    public ushort? Width { get; set; }
    public ushort? Height { get; set; }
    public uint? DurationSec { get; set; }
    public JsonDocument? Tags { get; set; }
    public bool IsPublic { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
    public Identity.User? Uploader { get; set; }
}
