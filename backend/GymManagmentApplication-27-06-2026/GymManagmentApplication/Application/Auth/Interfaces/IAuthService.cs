using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Responses;

using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Auth.Interfaces;

public record NewUser(
    ulong TenantId, ulong? BranchId, string RoleSlug,
    string Email, string Password, string? FirstName, string? LastName,
    UserStatus Status = UserStatus.Active);


public interface IAuthService
{
    Task<AuthResponse?> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// Creates a user in the given tenant/branch with that tenant's role. Returns null when
    /// the email is already taken. Used by self-registration and staff-created accounts.
    /// </summary>
    Task<User?> CreateUserAsync(NewUser spec);
    /// <summary>
    /// Null for wrong credentials. With 2FA on (and no remembered device) the response has
    /// RequiresTwoFactor = true, a ChallengeToken and Methods, and no tokens.
    /// </summary>
    Task<AuthResponse?> LoginAsync(LoginRequest request, SessionInfo? session = null);
    /// <summary>Second step of a 2FA sign-in: tokens, or an error (and whether the challenge is over).</summary>
    Task<Application.Auth.TwoFactor.TwoFactorVerifyResult> VerifyTwoFactorAsync(Application.Auth.TwoFactor.TwoFactorVerifyRequest request, SessionInfo? session = null);
    /// <summary>Emails a sign-in code for an open challenge; false when the challenge is no longer usable.</summary>
    Task<bool> SendTwoFactorEmailCodeAsync(string challengeToken);
    Task LogoutAsync(ulong userId, string? refreshToken);
    Task<AuthResponse?> RefreshAsync(string refreshToken, SessionInfo? session = null);
    Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request);
    Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request);
    Task<UserProfileResponse?> GetMeAsync(ulong userId);
    Task<bool> VerifyEmailAsync(VerifyEmailRequest request);
    Task<bool> ResendOtpAsync(ResendOtpRequest request);
}
