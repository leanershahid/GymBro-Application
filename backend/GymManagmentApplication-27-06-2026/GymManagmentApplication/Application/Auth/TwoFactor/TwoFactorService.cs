using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GymManagmentApplication.Application.Auth.TwoFactor;

/// <summary>
/// Two-step sign-in (roadmap feature 10): authenticator-app enrolment, recovery codes, login
/// challenges, remembered devices, the gym's policy and the admin reset. The login/verify endpoints
/// themselves live in AuthService (they issue the tokens); this service owns every 2FA record.
/// Methods that change tracked entities leave saving to the caller unless they say otherwise.
/// </summary>
public class TwoFactorService(IAppDbContext db, ISecretProtector secrets, ILogger<TwoFactorService> logger)
{
    public const string Issuer = "GymBro";
    public const string PolicySettingKey = "two-factor";
    public const int RecoveryCodeCount = 10;
    public static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(5);
    public static readonly TimeSpan TrustedDeviceLifetime = TimeSpan.FromDays(30);
    private static readonly TimeSpan PendingSetupLifetime = TimeSpan.FromMinutes(30);
    private const int MaxTrustedDevices = 10;
    /// <summary>GraceStartedAt marker for "grace already used up" (after an admin reset): setup is due at once.</summary>
    public static readonly DateTime GraceUsedUp = DateTime.UnixEpoch;

    // ── Policy ────────────────────────────────────────────────────────────────

    public async Task<TwoFactorPolicySettings> GetPolicyAsync(ulong tenantId)
    {
        var row = await db.TenantSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == PolicySettingKey);
        if (row?.Value is null) return new TwoFactorPolicySettings();
        try
        {
            var p = row.Value.Deserialize<TwoFactorPolicySettings>(JsonOptions) ?? new TwoFactorPolicySettings();
            p.GracePeriodDays = Math.Clamp(p.GracePeriodDays, 0, TwoFactorPolicySettings.MaxGraceDays);
            return p;
        }
        catch (JsonException)
        {
            return new TwoFactorPolicySettings();
        }
    }

    public async Task<TwoFactorPolicySettings> SavePolicyAsync(ulong tenantId, TwoFactorPolicySettings settings)
    {
        if (settings.GracePeriodDays is < 0 or > TwoFactorPolicySettings.MaxGraceDays)
            throw new ArgumentException($"Grace period must be between 0 and {TwoFactorPolicySettings.MaxGraceDays} days.");
        var json = JsonSerializer.SerializeToDocument(settings, JsonOptions);
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == PolicySettingKey);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = PolicySettingKey, Value = json });
        else row.Value = json;
        await db.SaveChangesAsync();
        return settings;
    }

    /// <summary>Super admins always; gym admins when RequireForAdmins; other staff roles when RequireForStaff; members never.</summary>
    public static bool IsRequiredFor(string roleSlug, TwoFactorPolicySettings policy) =>
        roleSlug.ToLowerInvariant() switch
        {
            RoleNames.SuperAdmin => true,
            RoleNames.Admin => policy.RequireForAdmins,
            RoleNames.Client => false,
            _ => policy.RequireForStaff, // trainer, staff and admin-defined custom roles
        };

    /// <summary>
    /// What the policy means for this user now. The first time 2FA is required of an unenrolled user
    /// their grace period starts (row added/updated — saved by the caller).
    /// </summary>
    public async Task<TwoFactorState> EvaluateAsync(User user, string roleSlug, DateTime? at = null)
    {
        var now = at ?? DateTime.UtcNow;
        var row = await db.UserTwoFactors.FirstOrDefaultAsync(x => x.UserId == user.Id);
        var enabled = row?.EnabledAt is not null;
        var policy = await GetPolicyAsync(user.TenantId);
        var required = IsRequiredFor(roleSlug, policy);

        if (enabled) return new TwoFactorState(true, required, null, false);
        if (!required)
        {
            // No longer required: a later re-requirement starts a fresh grace period
            // (an admin reset's "used up" marker is kept).
            if (row?.GraceStartedAt is { } started && started != GraceUsedUp) row.GraceStartedAt = null;
            return new TwoFactorState(false, false, null, false);
        }

        if (row is null)
        {
            row = new UserTwoFactor { UserId = user.Id, GraceStartedAt = now };
            db.UserTwoFactors.Add(row);
        }
        row.GraceStartedAt ??= now;
        var ends = row.GraceStartedAt.Value == GraceUsedUp ? now : row.GraceStartedAt.Value.AddDays(policy.GracePeriodDays);
        return new TwoFactorState(false, true, ends, now >= ends);
    }

    public Task<bool> IsEnabledAsync(ulong userId) =>
        db.UserTwoFactors.AnyAsync(x => x.UserId == userId && x.EnabledAt != null);

    /// <summary>Methods a login challenge offers: the app, an emailed code (if the user has an email) and unused recovery codes.</summary>
    public async Task<List<string>> MethodsAsync(ulong userId, bool hasEmail)
    {
        var methods = new List<string> { TwoFactorMethods.Totp };
        if (hasEmail) methods.Add(TwoFactorMethods.Email);
        if (await db.TwoFactorRecoveryCodes.AnyAsync(c => c.UserId == userId && c.UsedAt == null))
            methods.Add(TwoFactorMethods.Recovery);
        return methods;
    }

    // ── Login challenge ───────────────────────────────────────────────────────

    /// <summary>Starts the second step of a sign-in. Older open challenges of the user are dropped. Saves.</summary>
    public async Task<(string Token, DateTime ExpiresAt)> CreateChallengeAsync(ulong userId, string? ipAddress, DateTime? at = null)
    {
        var now = at ?? DateTime.UtcNow;
        await db.TwoFactorChallenges.Where(c => c.UserId == userId).ExecuteDeleteAsync();
        var token = NewToken();
        var expires = now.Add(ChallengeLifetime);
        db.TwoFactorChallenges.Add(new TwoFactorChallenge
        {
            UserId = userId, TokenHash = Hash(token), IpAddress = Truncate(ipAddress, 64), ExpiresAt = expires, CreatedAt = now,
        });
        await db.SaveChangesAsync();
        return (token, expires);
    }

    /// <summary>The challenge behind a token if it is still usable (not used, expired or burnt); tracked.</summary>
    public async Task<TwoFactorChallenge?> FindOpenChallengeAsync(string? token, DateTime? at = null)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var now = at ?? DateTime.UtcNow;
        var hash = Hash(token.Trim());
        var row = await db.TwoFactorChallenges.FirstOrDefaultAsync(c => c.TokenHash == hash);
        if (row is null || row.ConsumedAt is not null || row.ExpiresAt <= now || row.Attempts >= TwoFactorChallenge.MaxAttempts)
            return null;
        return row;
    }

    /// <summary>
    /// Marks a challenge used. Conditional, so two concurrent verifications of one challenge can't
    /// both succeed: only the caller that flips ConsumedAt gets true.
    /// </summary>
    public async Task<bool> ConsumeChallengeAsync(TwoFactorChallenge challenge, DateTime? at = null)
    {
        var now = at ?? DateTime.UtcNow;
        var n = await db.TwoFactorChallenges
            .Where(c => c.Id == challenge.Id && c.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.ConsumedAt, now));
        challenge.ConsumedAt = now;
        db.Entry(challenge).State = EntityState.Unchanged;
        return n == 1;
    }

    // ── Second factors ────────────────────────────────────────────────────────

    /// <summary>True for a current authenticator code not used before (the step is remembered; caller saves).</summary>
    public async Task<bool> VerifyTotpAsync(ulong userId, string? code, DateTime? at = null)
    {
        var row = await db.UserTwoFactors.FirstOrDefaultAsync(x => x.UserId == userId && x.EnabledAt != null);
        var secret = row is null ? null : secrets.Unprotect(row.SecretProtected);
        if (row is null || secret is null) return false;
        var step = Totp.Verify(Totp.FromBase32(secret), code, new DateTimeOffset(at ?? DateTime.UtcNow, TimeSpan.Zero), row.LastUsedStep);
        if (step is null) return false;
        row.LastUsedStep = step.Value;
        return true;
    }

    /// <summary>True (and the code is burnt — caller saves) for an unused recovery code.</summary>
    public async Task<bool> ConsumeRecoveryCodeAsync(ulong userId, string? code, DateTime? at = null)
    {
        var normalized = NormalizeRecoveryCode(code);
        if (normalized.Length != 10) return false;
        var hash = RecoveryHash(userId, normalized);
        var row = await db.TwoFactorRecoveryCodes.FirstOrDefaultAsync(c => c.UserId == userId && c.CodeHash == hash && c.UsedAt == null);
        if (row is null) return false;
        row.UsedAt = at ?? DateTime.UtcNow;
        logger.LogInformation("Recovery code used by user {UserId}.", userId);
        return true;
    }

    /// <summary>An authenticator code (6 digits) or a recovery code, for step-up checks in settings.</summary>
    public async Task<bool> VerifyAnyAsync(ulong userId, string? code) =>
        Totp.Normalize(code).Length == Totp.Digits && (code ?? "").Trim().Length <= 7
            ? await VerifyTotpAsync(userId, code)
            : await ConsumeRecoveryCodeAsync(userId, code);

    // ── Remembered devices ────────────────────────────────────────────────────

    public async Task<bool> IsTrustedDeviceAsync(ulong userId, string? deviceToken, DateTime? at = null)
    {
        if (string.IsNullOrWhiteSpace(deviceToken)) return false;
        var now = at ?? DateTime.UtcNow;
        var hash = Hash(deviceToken.Trim());
        var row = await db.TrustedDevices.FirstOrDefaultAsync(d => d.UserId == userId && d.TokenHash == hash);
        if (row is null || row.ExpiresAt <= now) return false;
        row.LastUsedAt = now; // saved with the sign-in
        return true;
    }

    /// <summary>Issues a device token valid for 30 days; keeps at most 10 per user (oldest dropped). Caller saves.</summary>
    public async Task<string> RememberDeviceAsync(ulong userId, SessionInfo? session, DateTime? at = null)
    {
        var now = at ?? DateTime.UtcNow;
        await db.TrustedDevices.Where(d => d.UserId == userId && d.ExpiresAt <= now).ExecuteDeleteAsync();
        var existing = await db.TrustedDevices.Where(d => d.UserId == userId)
            .OrderByDescending(d => d.CreatedAt).Skip(MaxTrustedDevices - 1).Select(d => d.Id).ToListAsync();
        if (existing.Count > 0) await db.TrustedDevices.Where(d => existing.Contains(d.Id)).ExecuteDeleteAsync();

        var token = NewToken();
        db.TrustedDevices.Add(new TrustedDevice
        {
            UserId = userId, TokenHash = Hash(token), ExpiresAt = now.Add(TrustedDeviceLifetime), CreatedAt = now,
            UserAgent = Truncate(session?.UserAgent, 255), IpAddress = Truncate(session?.IpAddress, 64),
        });
        return token;
    }

    public Task<int> ForgetDevicesAsync(ulong userId) =>
        db.TrustedDevices.Where(d => d.UserId == userId).ExecuteDeleteAsync();

    // ── Enrolment and management ──────────────────────────────────────────────

    public async Task<TwoFactorStatusResponse> GetStatusAsync(ulong userId)
    {
        var (user, role) = await LoadUserAsync(userId);
        var state = await EvaluateAsync(user, role);
        await db.SaveChangesAsync(); // a newly started grace period
        var row = await db.UserTwoFactors.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
        return new TwoFactorStatusResponse
        {
            Enabled = state.Enabled,
            EnabledAt = row?.EnabledAt,
            RecoveryCodesRemaining = await db.TwoFactorRecoveryCodes.CountAsync(c => c.UserId == userId && c.UsedAt == null),
            TrustedDevices = await db.TrustedDevices.CountAsync(d => d.UserId == userId && d.ExpiresAt > DateTime.UtcNow),
            Required = state.Required,
            GraceEndsAt = state.GraceEndsAt,
            SetupRequiredNow = state.SetupRequiredNow,
            Methods = state.Enabled ? await MethodsAsync(userId, !string.IsNullOrEmpty(user.Email)) : [],
        };
    }

    /// <summary>Starts (or restarts) authenticator setup: a new secret, pending until confirmed with a code.</summary>
    public async Task<TwoFactorSetupResponse> BeginSetupAsync(ulong userId)
    {
        var (user, _) = await LoadUserAsync(userId);
        var row = await db.UserTwoFactors.FirstOrDefaultAsync(x => x.UserId == userId);
        if (row?.EnabledAt is not null)
            throw new ArgumentException("Two-step sign-in is already on. Turn it off first to move to a new authenticator app.");
        if (row is null)
        {
            row = new UserTwoFactor { UserId = userId };
            db.UserTwoFactors.Add(row);
        }
        var secret = Totp.ToBase32(Totp.NewSecret());
        row.PendingSecretProtected = secrets.Protect(secret);
        row.PendingCreatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var account = user.Email ?? $"user-{user.Id}";
        return new TwoFactorSetupResponse
        {
            Secret = secret, SecretGrouped = Totp.Group(secret), Issuer = Issuer, Account = account,
            OtpAuthUri = Totp.OtpAuthUri(Issuer, account, secret),
        };
    }

    /// <summary>Confirms setup with a code from the app; turns 2FA on and returns the 10 recovery codes (shown once). Null for a wrong/expired code.</summary>
    public async Task<TwoFactorRecoveryCodesResponse?> EnableAsync(ulong userId, string? code, DateTime? at = null)
    {
        var now = at ?? DateTime.UtcNow;
        var row = await db.UserTwoFactors.FirstOrDefaultAsync(x => x.UserId == userId);
        if (row?.EnabledAt is not null) throw new ArgumentException("Two-step sign-in is already on.");
        if (row?.PendingSecretProtected is null || row.PendingCreatedAt is null || now - row.PendingCreatedAt > PendingSetupLifetime)
            throw new ArgumentException("Setup has expired. Start again to get a new key.");
        var secret = secrets.Unprotect(row.PendingSecretProtected)
            ?? throw new ArgumentException("Setup has expired. Start again to get a new key.");

        var step = Totp.Verify(Totp.FromBase32(secret), code, new DateTimeOffset(now, TimeSpan.Zero));
        if (step is null) return null;

        row.SecretProtected = row.PendingSecretProtected;
        row.PendingSecretProtected = null;
        row.PendingCreatedAt = null;
        row.EnabledAt = now;
        row.LastUsedStep = step.Value;
        row.GraceStartedAt = null;
        var codes = await ReplaceRecoveryCodesAsync(userId, now);
        await db.SaveChangesAsync();
        logger.LogInformation("Two-step sign-in enabled for user {UserId}.", userId);
        return new TwoFactorRecoveryCodesResponse { RecoveryCodes = codes };
    }

    /// <summary>
    /// Turns 2FA off — needs the password and a current code (or a recovery code). Refused while the
    /// gym's policy requires it. Recovery codes and remembered devices go too.
    /// </summary>
    public async Task DisableAsync(ulong userId, string password, string code)
    {
        var (user, role) = await LoadUserAsync(userId);
        if (!await IsEnabledAsync(userId)) throw new ArgumentException("Two-step sign-in is already off.");
        if (IsRequiredFor(role, await GetPolicyAsync(user.TenantId)))
            throw new UnauthorizedAccessException("Your gym requires two-step sign-in for your role, so it can't be turned off.");
        if (!PasswordHasher.Verify(password ?? string.Empty, user.PasswordHash, out _))
            throw new ArgumentException("Your password is incorrect.");
        if (!await VerifyAnyAsync(userId, code))
            throw new ArgumentException("That code is incorrect or has already been used.");

        await ClearAsync(userId, graceStartedAt: null);
        await db.SaveChangesAsync();
        logger.LogInformation("Two-step sign-in disabled by user {UserId}.", userId);
    }

    /// <summary>New set of 10 recovery codes (the old ones stop working) — needs a current code. Null for a wrong code.</summary>
    public async Task<TwoFactorRecoveryCodesResponse?> RegenerateRecoveryCodesAsync(ulong userId, string code)
    {
        if (!await IsEnabledAsync(userId)) throw new ArgumentException("Turn on two-step sign-in first.");
        if (!await VerifyAnyAsync(userId, code)) return null;
        var codes = await ReplaceRecoveryCodesAsync(userId, DateTime.UtcNow);
        await db.SaveChangesAsync();
        return new TwoFactorRecoveryCodesResponse { RecoveryCodes = codes };
    }

    /// <summary>
    /// Admin recovery: removes another user's 2FA (lost phone, no recovery codes), signs them out
    /// everywhere and audit-logs it. If their role requires 2FA they must set it up again at their
    /// next sign-in, with no new grace period. Admins act in their own gym; only a super admin may
    /// reset a super admin. Nobody resets their own (use disable).
    /// </summary>
    public async Task AdminResetAsync(ulong actorUserId, bool actorIsSuperAdmin, ulong targetUserId, string? reason,
        string? ipAddress, string? userAgent)
    {
        if (actorUserId == targetUserId)
            throw new ArgumentException("You can't reset your own two-step sign-in. Use a recovery code or turn it off in settings.");
        // Tenant query filter applies: an admin only finds users of their own gym.
        var target = await db.Users.FirstOrDefaultAsync(u => u.Id == targetUserId && u.DeletedAt == null)
            ?? throw new KeyNotFoundException("User not found.");
        var targetRole = await RoleSlugAsync(target);
        if (targetRole == RoleNames.SuperAdmin && !actorIsSuperAdmin)
            throw new UnauthorizedAccessException("Only a super admin can reset a super admin's two-step sign-in.");

        var wasEnabled = await IsEnabledAsync(targetUserId);
        await ClearAsync(targetUserId, graceStartedAt: GraceUsedUp);
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = target.TenantId, UserId = actorUserId, Action = "two_factor.reset", EntityType = "User",
            EntityId = targetUserId, IpAddress = Truncate(ipAddress, 64), UserAgent = Truncate(userAgent, 255),
            OldValues = JsonSerializer.SerializeToDocument(new { enabled = wasEnabled }),
            NewValues = JsonSerializer.SerializeToDocument(new { enabled = false, reason = Truncate(reason?.Trim(), 500) }),
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, targetUserId);
        logger.LogWarning("Two-step sign-in of user {Target} reset by {Actor}.", targetUserId, actorUserId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Removes the secret, recovery codes, remembered devices and open challenges of a user (caller saves the row).</summary>
    private async Task ClearAsync(ulong userId, DateTime? graceStartedAt)
    {
        var row = await db.UserTwoFactors.FirstOrDefaultAsync(x => x.UserId == userId);
        if (row is null)
        {
            row = new UserTwoFactor { UserId = userId };
            db.UserTwoFactors.Add(row);
        }
        row.SecretProtected = null;
        row.PendingSecretProtected = null;
        row.PendingCreatedAt = null;
        row.EnabledAt = null;
        row.LastUsedStep = 0;
        row.GraceStartedAt = graceStartedAt;
        await db.TwoFactorRecoveryCodes.Where(c => c.UserId == userId).ExecuteDeleteAsync();
        await db.TrustedDevices.Where(d => d.UserId == userId).ExecuteDeleteAsync();
        await db.TwoFactorChallenges.Where(c => c.UserId == userId).ExecuteDeleteAsync();
    }

    private async Task<List<string>> ReplaceRecoveryCodesAsync(ulong userId, DateTime now)
    {
        await db.TwoFactorRecoveryCodes.Where(c => c.UserId == userId).ExecuteDeleteAsync();
        var codes = new List<string>(RecoveryCodeCount);
        for (var i = 0; i < RecoveryCodeCount; i++)
        {
            var raw = NewRecoveryCode();
            codes.Add($"{raw[..5]}-{raw[5..]}");
            db.TwoFactorRecoveryCodes.Add(new TwoFactorRecoveryCode { UserId = userId, CodeHash = RecoveryHash(userId, raw), CreatedAt = now });
        }
        return codes;
    }

    private async Task<(User User, string Role)> LoadUserAsync(ulong userId)
    {
        var user = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null)
            ?? throw new KeyNotFoundException("User not found.");
        return (user, await RoleSlugAsync(user));
    }

    private async Task<string> RoleSlugAsync(User user)
    {
        if (user.RoleId == 0) return RoleNames.Client;
        var slug = await db.Roles.IgnoreQueryFilters()
            .Where(r => r.Id == user.RoleId && r.TenantId == user.TenantId).Select(r => r.Slug).FirstOrDefaultAsync();
        return slug ?? RoleNames.Client;
    }

    // No 0/o, 1/l/i: easy to read off paper.
    private const string RecoveryAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    private static string NewRecoveryCode() =>
        new(Enumerable.Range(0, 10).Select(_ => RecoveryAlphabet[RandomNumberGenerator.GetInt32(RecoveryAlphabet.Length)]).ToArray());

    public static string NormalizeRecoveryCode(string? code) =>
        new((code ?? string.Empty).ToLowerInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());

    private static string RecoveryHash(ulong userId, string normalized) => Hash($"recovery:{userId}:{normalized}");

    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private static string? Truncate(string? v, int max) => v is null || v.Length <= max ? v : v[..max];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}
