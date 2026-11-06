using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Orders;

public interface IShopAddressService
{
    Task<IReadOnlyList<ShopAddressDto>> GetAllAsync();
    Task<ShopAddressDto> CreateAsync(ShopAddressRequest request);
    Task<ShopAddressDto> UpdateAsync(ulong id, ShopAddressRequest request);
    Task<ShopAddressDto> SetDefaultAsync(ulong id);
    Task DeleteAsync(ulong id);
}

/// <summary>The member's saved delivery addresses (the address part of the store's CustomerService).</summary>
public sealed partial class ShopAddressService(IAppDbContext db, ICurrentUser currentUser) : IShopAddressService
{
    public const int MaxAddresses = 20;

    private ulong TenantId => currentUser.ResolveTenantId();
    private ulong UserId => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    private IQueryable<ShopAddress> Mine(ulong tid, ulong uid) =>
        db.ShopAddresses.Where(a => a.TenantId == tid && a.UserId == uid && a.DeletedAt == null);

    public async Task<IReadOnlyList<ShopAddressDto>> GetAllAsync()
    {
        var addresses = await Mine(TenantId, UserId).AsNoTracking()
            .OrderByDescending(a => a.IsDefault).ThenByDescending(a => a.CreatedAt)
            .ToListAsync();
        return addresses.Select(ToDto).ToList();
    }

    public async Task<ShopAddressDto> CreateAsync(ShopAddressRequest request)
    {
        Validate(request);
        var tid = TenantId;
        var uid = UserId;
        var existing = await Mine(tid, uid).ToListAsync();
        if (existing.Count >= MaxAddresses)
            throw ShopRuleException.Rule($"You can save at most {MaxAddresses} addresses.");

        var address = new ShopAddress { Id = 0, TenantId = tid, UserId = uid };
        Apply(address, request);
        address.IsDefault = request.IsDefault || existing.Count == 0;
        if (address.IsDefault) existing.ForEach(a => a.IsDefault = false);

        db.ShopAddresses.Add(address);
        await db.SaveChangesAsync();
        return ToDto(address);
    }

    public async Task<ShopAddressDto> UpdateAsync(ulong id, ShopAddressRequest request)
    {
        Validate(request);
        var addresses = await Mine(TenantId, UserId).ToListAsync();
        var address = addresses.FirstOrDefault(a => a.Id == id) ?? throw new KeyNotFoundException("Address not found");

        Apply(address, request);
        address.UpdatedAt = DateTime.UtcNow;
        if (request.IsDefault)
            MakeDefault(addresses, address);
        else if (address.IsDefault)
        {
            // Un-defaulting: hand the default flag to the most recent other address, if any.
            var next = addresses.Where(a => a.Id != address.Id).OrderByDescending(a => a.CreatedAt).FirstOrDefault();
            if (next is not null)
            {
                address.IsDefault = false;
                next.IsDefault = true;
            }
        }

        await db.SaveChangesAsync();
        return ToDto(address);
    }

    public async Task<ShopAddressDto> SetDefaultAsync(ulong id)
    {
        var addresses = await Mine(TenantId, UserId).ToListAsync();
        var address = addresses.FirstOrDefault(a => a.Id == id) ?? throw new KeyNotFoundException("Address not found");
        MakeDefault(addresses, address);
        await db.SaveChangesAsync();
        return ToDto(address);
    }

    public async Task DeleteAsync(ulong id)
    {
        var addresses = await Mine(TenantId, UserId).ToListAsync();
        var address = addresses.FirstOrDefault(a => a.Id == id) ?? throw new KeyNotFoundException("Address not found");

        address.DeletedAt = DateTime.UtcNow;
        address.UpdatedAt = DateTime.UtcNow;
        if (address.IsDefault)
        {
            address.IsDefault = false;
            var next = addresses.Where(a => a.Id != address.Id).OrderByDescending(a => a.CreatedAt).FirstOrDefault();
            if (next is not null) next.IsDefault = true;
        }

        await db.SaveChangesAsync();
    }

    public static ShopAddressDto ToDto(ShopAddress a) => new()
    {
        Id = a.Id,
        Label = a.Label,
        FullName = a.FullName,
        Phone = a.Phone,
        Line1 = a.Line1,
        Line2 = a.Line2,
        City = a.City,
        State = a.State,
        PostalCode = a.PostalCode,
        Country = a.Country,
        IsDefault = a.IsDefault
    };

    private static void MakeDefault(List<ShopAddress> addresses, ShopAddress target)
    {
        foreach (var a in addresses) a.IsDefault = a.Id == target.Id;
    }

    private static void Apply(ShopAddress address, ShopAddressRequest r)
    {
        address.Label = string.IsNullOrWhiteSpace(r.Label) ? null : r.Label.Trim();
        address.FullName = r.FullName.Trim();
        address.Phone = r.Phone.Trim();
        address.Line1 = r.Line1.Trim();
        address.Line2 = string.IsNullOrWhiteSpace(r.Line2) ? null : r.Line2.Trim();
        address.City = r.City.Trim();
        address.State = r.State.Trim();
        address.PostalCode = r.PostalCode.Trim();
        address.Country = string.IsNullOrWhiteSpace(r.Country) ? "India" : r.Country.Trim();
    }

    /// <summary>The store's AddressRequestValidator.</summary>
    private static void Validate(ShopAddressRequest r)
    {
        if (r is null) throw new ArgumentException("Address details are required.");
        static void Required(string? value, string field, int max)
        {
            if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException($"{field} is required.");
            if (value.Trim().Length > max) throw new ArgumentException($"{field} must be at most {max} characters.");
        }
        static void Optional(string? value, string field, int max)
        {
            if (value is not null && value.Trim().Length > max) throw new ArgumentException($"{field} must be at most {max} characters.");
        }

        Optional(r.Label, "Label", 50);
        Required(r.FullName, "Full name", 150);
        Required(r.Phone, "Phone", 32);
        if (!PhonePattern().IsMatch(r.Phone.Trim())) throw new ArgumentException("Phone number is not valid.");
        Required(r.Line1, "Address line 1", 200);
        Optional(r.Line2, "Address line 2", 200);
        Required(r.City, "City", 100);
        Required(r.State, "State", 100);
        Required(r.PostalCode, "PIN code", 20);
        var country = string.IsNullOrWhiteSpace(r.Country) ? "India" : r.Country.Trim();
        if (country.Length > 100) throw new ArgumentException("Country must be at most 100 characters.");
        if (string.Equals(country, "India", StringComparison.OrdinalIgnoreCase) && !IndianPin().IsMatch(r.PostalCode.Trim()))
            throw new ArgumentException("Enter a valid 6-digit PIN code.");
    }

    [GeneratedRegex(@"^\+?[0-9 ()\-]{7,20}$")] private static partial Regex PhonePattern();
    [GeneratedRegex("^[1-9][0-9]{5}$")] private static partial Regex IndianPin();
}
