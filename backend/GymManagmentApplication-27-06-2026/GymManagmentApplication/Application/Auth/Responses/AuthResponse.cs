namespace GymManagmentApplication.Application.Auth.Responses;

public class AuthResponse
{
    public string AccessToken { get; set; } = default!;
    public string RefreshToken { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public string Role { get; set; } = default!;
    public ulong UserId { get; set; }
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public string Email { get; set; } = default!;

    // ── Two-step sign-in (feature 10). All additive: older clients ignore them. ──
    /// <summary>
    /// True when the password was right but a second step is needed: no tokens are issued; send
    /// <see cref="ChallengeToken"/> with a code to POST /api/auth/2fa/verify.
    /// </summary>
    public bool RequiresTwoFactor { get; set; }
    public string? ChallengeToken { get; set; }
    public DateTime? ChallengeExpiresAt { get; set; }
    /// <summary>Second-step methods on offer: "totp", "email", "recovery".</summary>
    public List<string>? Methods { get; set; }
    /// <summary>Returned by 2fa/verify when "remember this device" was ticked: send it as LoginRequest.DeviceToken.</summary>
    public string? DeviceToken { get; set; }
    /// <summary>The gym requires 2FA of this user and they haven't set it up (see <see cref="TwoFactorGraceEndsAt"/>).</summary>
    public bool TwoFactorSetupRequired { get; set; }
    /// <summary>Grace period over: the tokens only reach /api/auth/* until setup is done.</summary>
    public bool TwoFactorSetupBlocking { get; set; }
    public DateTime? TwoFactorGraceEndsAt { get; set; }
}

public class UserProfileResponse
{
    public ulong UserId { get; set; }
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public string Email { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string Role { get; set; } = default!;
    public bool IsEmailVerified { get; set; }
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
}
