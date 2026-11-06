namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// A user's two-step sign-in state (roadmap feature 10). One row per user, created the first time
/// they start setup or the gym's policy first requires it of them (which starts their grace period).
/// Secrets are stored encrypted with ISecretProtector, never in clear.
/// </summary>
public class UserTwoFactor : BaseEntity
{
    public ulong UserId { get; set; }
    /// <summary>The confirmed authenticator-app (TOTP) secret, Base32, encrypted. Null = not enrolled.</summary>
    public string? SecretProtected { get; set; }
    /// <summary>When the authenticator app was confirmed. Non-null = two-step sign-in is on.</summary>
    public DateTime? EnabledAt { get; set; }
    /// <summary>A secret handed out by setup but not yet confirmed with a code (encrypted).</summary>
    public string? PendingSecretProtected { get; set; }
    public DateTime? PendingCreatedAt { get; set; }
    /// <summary>Highest TOTP time step accepted so far; a code from that step or earlier is a replay.</summary>
    public long LastUsedStep { get; set; }
    /// <summary>When the gym's policy first required 2FA of this (unenrolled) user; the grace period runs from here.</summary>
    public DateTime? GraceStartedAt { get; set; }

    public User User { get; set; } = default!;
}

/// <summary>One of the 10 single-use recovery codes, stored as a hash only.</summary>
public class TwoFactorRecoveryCode
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string CodeHash { get; set; } = default!;
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}

/// <summary>
/// The pending second step of a sign-in whose password was correct. Identified by a random token
/// (only its hash is stored); short-lived, single-use and burnt after <see cref="MaxAttempts"/> wrong codes.
/// </summary>
public class TwoFactorChallenge
{
    public const int MaxAttempts = 5;
    public const int MaxEmailSends = 3;

    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string TokenHash { get; set; } = default!;
    public int Attempts { get; set; }
    public int EmailSends { get; set; }
    public string? IpAddress { get; set; }
    public DateTime ExpiresAt { get; set; }
    /// <summary>Set when the challenge succeeded or was invalidated; it can never be used again.</summary>
    public DateTime? ConsumedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}

/// <summary>
/// "Remember this device for 30 days": a random device token held by the app (only its hash is
/// stored, like a refresh token). Deleted on password change/reset, revoke-all, 2FA disable/reset.
/// </summary>
public class TrustedDevice
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public string TokenHash { get; set; } = default!;
    public string? UserAgent { get; set; }
    public string? IpAddress { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}
