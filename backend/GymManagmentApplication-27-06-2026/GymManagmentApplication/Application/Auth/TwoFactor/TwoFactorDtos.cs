namespace GymManagmentApplication.Application.Auth.TwoFactor;

/// <summary>Second-step methods, as sent by the client and listed in a login challenge.</summary>
public static class TwoFactorMethods
{
    public const string Totp = "totp";
    public const string Email = "email";
    public const string Recovery = "recovery";
}

/// <summary>JWT claim on an access token whose user must set up 2FA before using the rest of the API.</summary>
public static class TwoFactorClaims
{
    public const string SetupRequired = "tfa_setup";
    public const string SetupRequiredValue = "required";
    /// <summary>Error code in the 403 envelope's <c>errors</c> list, for clients to route to setup.</summary>
    public const string SetupRequiredError = "two_factor_setup_required";
}

public class TwoFactorVerifyRequest
{
    public string ChallengeToken { get; set; } = default!;
    public string Code { get; set; } = default!;
    /// <summary>"totp" (default), "email" or "recovery".</summary>
    public string? Method { get; set; }
    public bool RememberDevice { get; set; }
}

public class TwoFactorChallengeRequest
{
    public string ChallengeToken { get; set; } = default!;
}

public class TwoFactorCodeRequest
{
    public string Code { get; set; } = default!;
}

public class TwoFactorDisableRequest
{
    public string Password { get; set; } = default!;
    /// <summary>A current authenticator code or an unused recovery code.</summary>
    public string Code { get; set; } = default!;
}

public class TwoFactorSetupResponse
{
    /// <summary>Base32 secret ("setup key") for typing into an authenticator app.</summary>
    public string Secret { get; set; } = default!;
    /// <summary>The same secret grouped in fours for display.</summary>
    public string SecretGrouped { get; set; } = default!;
    /// <summary>otpauth:// URI — render as a QR code, or open directly on the same phone.</summary>
    public string OtpAuthUri { get; set; } = default!;
    public string Issuer { get; set; } = default!;
    public string Account { get; set; } = default!;
}

public class TwoFactorRecoveryCodesResponse
{
    /// <summary>Shown once; only hashes are stored.</summary>
    public List<string> RecoveryCodes { get; set; } = [];
}

public class TwoFactorStatusResponse
{
    public bool Enabled { get; set; }
    public DateTime? EnabledAt { get; set; }
    public int RecoveryCodesRemaining { get; set; }
    public int TrustedDevices { get; set; }
    /// <summary>The gym's policy (or super-admin rule) requires 2FA for this user.</summary>
    public bool Required { get; set; }
    /// <summary>Required and not enrolled: the end of the grace period (null when not applicable).</summary>
    public DateTime? GraceEndsAt { get; set; }
    /// <summary>Required, not enrolled and the grace period is over: setup can't be skipped.</summary>
    public bool SetupRequiredNow { get; set; }
    public List<string> Methods { get; set; } = [];
}

/// <summary>A gym's two-step sign-in policy (TenantSettings key "two-factor").</summary>
public class TwoFactorPolicySettings
{
    public const int MaxGraceDays = 30;
    /// <summary>Require 2FA for the gym's admin role. Default on.</summary>
    public bool RequireForAdmins { get; set; } = true;
    /// <summary>Require 2FA for every other staff role (trainer, staff, custom roles). Default off.</summary>
    public bool RequireForStaff { get; set; }
    /// <summary>Days a newly-required user may keep signing in before setting up (0–30). Default 7.</summary>
    public int GracePeriodDays { get; set; } = 7;
}

/// <summary>What the policy means for one user right now.</summary>
public record TwoFactorState(bool Enabled, bool Required, DateTime? GraceEndsAt, bool SetupRequiredNow);

public record TwoFactorVerifyResult(
    Responses.AuthResponse? Tokens, string? Error = null, bool ChallengeEnded = false, int AttemptsRemaining = 0);
