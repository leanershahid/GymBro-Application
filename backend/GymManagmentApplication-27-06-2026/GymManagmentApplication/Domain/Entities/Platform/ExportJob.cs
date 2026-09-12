using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Platform;

public class ExportJob
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong RequestedBy { get; set; }
    public string ReportType { get; set; } = default!;
    public System.Text.Json.JsonDocument? Filters { get; set; }
    public ExportJobStatus Status { get; set; } = ExportJobStatus.Queued;
    public string? FileUrl { get; set; }
    public uint? FileSize { get; set; }
    public uint? RowCount { get; set; }
    public string? ErrorMsg { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
