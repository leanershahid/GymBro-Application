using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Auth;

/// <summary>Where a sign-in came from; stored on the refresh-token session.</summary>
public record SessionInfo(string? IpAddress, string? UserAgent, DeviceType DeviceType = DeviceType.Web);

public static class AuthSessions
{
    /// <summary>
    /// Signs a user out everywhere: deletes their refresh-token sessions and bumps TokenVersion,
    /// so access tokens already issued are rejected by <see cref="TokenValidator"/> too (within its cache window).
    /// Used on password change/reset, role change, deactivation and deletion.
    /// </summary>
    public static async Task RevokeAllAsync(AppDbContext db, ulong userId)
    {
        await db.UserSessions.Where(s => s.UserId == userId).ExecuteDeleteAsync();
        await db.Users.IgnoreQueryFilters().Where(u => u.Id == userId)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.TokenVersion, x => x.TokenVersion + 1));
    }
}
