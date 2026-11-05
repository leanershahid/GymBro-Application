using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Common;

// Shared shop rules, ported from the Unique Lights store (Services/Common/Helpers.cs, CommerceOptions).

public static class ShopPricing
{
    /// <summary>Round half away from zero to 2 decimals (money).</summary>
    public static decimal Round(decimal value) => Money.Round(value);

    /// <summary>Compare-at price only when it is actually higher than the selling price.</summary>
    public static decimal? EffectiveCompareAt(decimal price, decimal? compareAt) =>
        compareAt.HasValue && compareAt.Value > price ? compareAt : null;

    /// <summary>Integer discount percentage (1–99) when compareAt &gt; price, otherwise null.</summary>
    public static int? DiscountPercent(decimal price, decimal? compareAt)
    {
        if (!compareAt.HasValue || compareAt.Value <= 0 || compareAt.Value <= price) return null;
        var percent = (int)Math.Round((compareAt.Value - price) / compareAt.Value * 100m, MidpointRounding.AwayFromZero);
        return Math.Clamp(percent, 1, 99);
    }

    /// <summary>
    /// The variant a product is listed at: the first active one by IsDefault desc, Price asc, Id.
    /// Null when the product has no active variant (then BasePrice is shown).
    /// </summary>
    public static ShopVariant? DefaultVariant(IEnumerable<ShopVariant> variants) =>
        variants.Where(v => v.IsActive && v.DeletedAt == null)
            .OrderByDescending(v => v.IsDefault).ThenBy(v => v.Price).ThenBy(v => v.Id)
            .FirstOrDefault();
}

public static class ShopSlug
{
    public static string Slugify(string value) => Slug.From(value);
}

public static class ShopSearch
{
    public const string EscapeCharacter = "\\";

    /// <summary>Builds a "%term%" ILIKE pattern with %, _ and \ escaped.</summary>
    public static string Contains(string term)
    {
        var escaped = term.Trim()
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
        return $"%{escaped}%";
    }

    public static List<string> SplitList(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(s => s.Length > 0).Distinct(StringComparer.Ordinal).Take(50).ToList();

    /// <summary>Paging as the store does it: page from 1, page size 1–100 (default 12).</summary>
    public static (int Page, int Size) Paging(int page, int pageSize, int defaultSize = 12) =>
        (Math.Max(1, page), pageSize <= 0 ? defaultSize : Math.Clamp(pageSize, 1, 100));

    public static PagedResponse<T> Page<T>(IEnumerable<T> items, int page, int size, int total) =>
        new() { Items = items, PageNumber = page, PageSize = size, TotalRecords = total };
}

/// <summary>
/// A gym's shop settings (TenantSettings, key "shop"): money rules for checkout plus the contact
/// details shown in the store. Defaults match the Unique Lights store.
/// </summary>
public class ShopSettings
{
    public string Name { get; set; } = "Gym Shop";
    public string? Tagline { get; set; }
    public string Currency { get; set; } = "INR";
    /// <summary>GST as a fraction of (subtotal − discount), e.g. 0.18.</summary>
    public decimal TaxRate { get; set; } = 0.18m;
    public decimal FreeShippingThreshold { get; set; } = 2000m;
    public decimal StandardShipping { get; set; } = 149m;
    public decimal ExpressShipping { get; set; } = 349m;
    public int StandardDeliveryDays { get; set; } = 5;
    public int ExpressDeliveryDays { get; set; } = 2;
    public int ReturnDays { get; set; } = 7;
    /// <summary>Order number prefix, e.g. "GB" → GB-10001.</summary>
    public string OrderPrefix { get; set; } = "GB";
    public string? SupportEmail { get; set; }
    public string? SupportPhone { get; set; }
    public string? Address { get; set; }
    public string? BusinessHours { get; set; }
}

public interface IShopSettingsService
{
    Task<ShopSettings> GetAsync(ulong? tenantId = null);
    Task<ShopSettings> UpdateAsync(ShopSettings settings);
}

public class ShopSettingsService(AppDbContext db, ICurrentUser currentUser) : IShopSettingsService
{
    private const string Key = "shop";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<ShopSettings> GetAsync(ulong? tenantId = null)
    {
        var tid = tenantId ?? currentUser.ResolveTenantId();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tid && s.Key == Key);
        return row?.Value?.Deserialize<ShopSettings>(Json) ?? new ShopSettings();
    }

    public async Task<ShopSettings> UpdateAsync(ShopSettings s)
    {
        if (s.TaxRate is < 0 or > 1) throw new ArgumentException("Tax rate must be between 0 and 1 (e.g. 0.18 for 18%).");
        if (s.FreeShippingThreshold < 0 || s.StandardShipping < 0 || s.ExpressShipping < 0)
            throw new ArgumentException("Delivery amounts can't be negative.");
        if (s.StandardDeliveryDays is < 0 or > 60 || s.ExpressDeliveryDays is < 0 or > 60)
            throw new ArgumentException("Delivery days must be between 0 and 60.");
        if (s.ReturnDays is < 0 or > 365) throw new ArgumentException("Return window must be between 0 and 365 days.");
        if (string.IsNullOrWhiteSpace(s.Name)) throw new ArgumentException("The shop needs a name.");
        s.OrderPrefix = new string((s.OrderPrefix ?? "GB").ToUpperInvariant().Where(char.IsLetterOrDigit).Take(6).ToArray());
        if (s.OrderPrefix.Length == 0) s.OrderPrefix = "GB";

        var tid = currentUser.ResolveTenantId();
        var row = await db.TenantSettings.FirstOrDefaultAsync(x => x.TenantId == tid && x.Key == Key);
        var value = JsonSerializer.SerializeToDocument(s, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tid, Key = Key, Value = value });
        else { row.Value = value; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync();
        return s;
    }
}

public static class ShopOrderNumbers
{
    private const string CounterKey = "shop-order";

    /// <summary>
    /// The gym's next order number: "{prefix}-{n}", n starting at 10001. Drawn from the gym's
    /// TenantCounters row with one atomic upsert (ARCH-006), so racing checkouts never get the same
    /// number; inside the placing transaction the row stays locked until commit, and a rolled-back
    /// attempt gives its number back. The first call continues from the newest existing order.
    /// </summary>
    public static async Task<string> NextAsync(AppDbContext db, ulong tenantId, string prefix)
    {
        long floor = 10001;
        if (!await db.TenantCounters.IgnoreQueryFilters().AnyAsync(c => c.TenantId == tenantId && c.Key == CounterKey))
        {
            // Ids only grow, so the newest order holds the highest number (the prefix may have changed since).
            var last = await db.ShopOrders.IgnoreQueryFilters()
                .Where(o => o.TenantId == tenantId)
                .OrderByDescending(o => o.Id)
                .Select(o => o.OrderNumber)
                .FirstOrDefaultAsync();
            if (last is not null && long.TryParse(last[(last.LastIndexOf('-') + 1)..], out var v)) floor = Math.Max(v + 1, floor);
        }
        var n = await TenantCounters.NextAsync(db, tenantId, CounterKey, floor);
        return $"{prefix}-{n}";
    }
}
