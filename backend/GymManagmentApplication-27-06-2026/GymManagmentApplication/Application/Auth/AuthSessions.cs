using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Auth;

/// <summary>Where a sign-in came from; stored on the refresh-token session.</summary>
public record SessionInfo(string? IpAddress, string? UserAgent, DeviceType DeviceType = DeviceType.Web);

public static class AuthSessions
{
    /// <summary>
    /// Signs a user out everywhere: deletes their refresh-token sessions and bumps TokenVersion,
    /// so access tokens already issued are rejected by <see cref="TokenValidator"/> too — immediately on this
    /// instance (its cached token state is dropped), within its 30-second cache window on others.
    /// Used on password change/reset, role change, deactivation and deletion.
    /// "Remember this device" tokens (2FA) and pending 2FA login challenges go too, so a changed
    /// password always means the second step is asked again.
    /// </summary>
    public static async Task RevokeAllAsync(IAppDbContext db, ulong userId)
    {
        await db.UserSessions.Where(s => s.UserId == userId).ExecuteDeleteAsync();
        await db.TrustedDevices.Where(d => d.UserId == userId).ExecuteDeleteAsync();
        await db.TwoFactorChallenges.Where(c => c.UserId == userId).ExecuteDeleteAsync();
        await db.Users.IgnoreQueryFilters().Where(u => u.Id == userId)
            .ExecuteUpdateAsync(u => u.SetProperty(x => x.TokenVersion, x => x.TokenVersion + 1));
        TokenValidator.Revoke(userId);
    }
}
