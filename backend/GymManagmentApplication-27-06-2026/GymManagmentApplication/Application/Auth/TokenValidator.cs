using System.Security.Claims;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GymManagmentApplication.Application.Auth;

/// <summary>
/// Runs on every authenticated request (JwtBearerEvents.OnTokenValidated). A token stays valid
/// only while its user still exists, is not suspended/inactive, still holds the same role in the
/// same gym, and that gym is not suspended/cancelled — so demotions, deactivations and closed
/// gyms take effect within <see cref="CacheFor"/> instead of when the token expires.
/// </summary>
public static class TokenValidator
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    public static async Task<string?> GetRejectionReasonAsync(ClaimsPrincipal principal, AppDbContext db, IMemoryCache cache)
    {
        if (!ulong.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return "Invalid token.";
        var role = principal.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var tenant = principal.FindFirstValue(CustomClaims.TenantId) ?? string.Empty;

        var key = $"token-state:{userId}";
        if (!cache.TryGetValue(key, out (string Role, string Tenant, string? Problem) state))
        {
            var row = await db.Users.IgnoreQueryFilters()
                .Where(u => u.Id == userId)
                .Select(u => new
                {
                    u.DeletedAt, u.Status, u.TenantId,
                    Role = db.Roles.IgnoreQueryFilters()
                        .Where(r => r.Id == u.RoleId && r.TenantId == u.TenantId)
                        .Select(r => r.Slug).FirstOrDefault(),
                    TenantStatus = db.Tenants.Where(t => t.Id == u.TenantId).Select(t => t.Status).FirstOrDefault(),
                })
                .FirstOrDefaultAsync();

            string? problem =
                row is null || row.DeletedAt != null ? "This account no longer exists." :
                row.Status is UserStatus.Suspended or UserStatus.Inactive ? "This account has been deactivated." :
                row.TenantStatus is TenantStatus.Suspended or TenantStatus.Cancelled ? "This gym's account is not active." :
                null;
            state = (row?.Role ?? RoleNames.Client, row?.TenantId.ToString() ?? string.Empty, problem);
            cache.Set(key, state, CacheFor);
        }

        if (state.Problem is not null) return state.Problem;
        if (!string.Equals(state.Role, role, StringComparison.OrdinalIgnoreCase) || state.Tenant != tenant)
            return "Your access has changed. Please sign in again.";
        return null;
    }

    /// <summary>Drop the cached state so a change (role, status, deletion) applies immediately.</summary>
    public static void Invalidate(IMemoryCache cache, ulong userId) => cache.Remove($"token-state:{userId}");
}
