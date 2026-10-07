using System.Security.Claims;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// The authenticated caller, resolved from the JWT. TenantId/BranchId come from the
/// <see cref="CustomClaims"/> issued at login, so services never have to trust a
/// tenant id sent in a request body.
/// </summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    ulong? UserId { get; }
    string Role { get; }
    ulong? TenantId { get; }
    ulong? BranchId { get; }

    /// <summary>Platform-level admin: manages tenants and sees every tenant's data.</summary>
    bool IsSuperAdmin { get; }

    /// <summary>Tenant admin or super admin.</summary>
    bool IsAdmin { get; }

    /// <summary>
    /// The tenant a write should be stamped with. Super admins may target another tenant
    /// via <paramref name="requested"/>; everyone else is pinned to their own tenant.
    /// </summary>
    ulong ResolveTenantId(ulong? requested = null);
}

public static class CustomClaims
{
    public const string TenantId = "tenant_id";
    public const string BranchId = "branch_id";
}

public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public ulong? UserId => ParseClaim(ClaimTypes.NameIdentifier);

    public string Role => Principal?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public ulong? TenantId => ParseClaim(CustomClaims.TenantId);

    public ulong? BranchId => ParseClaim(CustomClaims.BranchId);

    public bool IsSuperAdmin => Role.Equals(RoleNames.SuperAdmin, StringComparison.OrdinalIgnoreCase);

    public bool IsAdmin => IsSuperAdmin || Role.Equals(RoleNames.Admin, StringComparison.OrdinalIgnoreCase);

    public ulong ResolveTenantId(ulong? requested = null)
    {
        if (IsSuperAdmin && requested is > 0) return requested.Value;
        return TenantId ?? throw new UnauthorizedAccessException("Your session has no tenant. Please sign in again.");
    }

    private ulong? ParseClaim(string type) =>
        ulong.TryParse(Principal?.FindFirstValue(type), out var value) ? value : null;
}
