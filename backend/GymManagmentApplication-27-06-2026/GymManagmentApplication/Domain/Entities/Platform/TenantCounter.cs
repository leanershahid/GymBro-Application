namespace GymManagmentApplication.Domain.Entities.Platform;

/// <summary>
/// A per-gym running number (e.g. "invoice:2026" or "shop-order"). Incremented atomically with
/// INSERT … ON CONFLICT DO UPDATE … RETURNING, so two requests never get the same number.
/// Key: (TenantId, Key).
/// </summary>
public class TenantCounter
{
    public ulong TenantId { get; set; }
    public string Key { get; set; } = default!;
    public long Value { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
