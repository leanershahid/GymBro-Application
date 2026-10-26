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
    Task<AuthResponse?> LoginAsync(LoginRequest request);
    Task LogoutAsync(ulong userId);
    Task<AuthResponse?> RefreshAsync(string refreshToken);
    Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request);
    Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request);
    Task<UserProfileResponse?> GetMeAsync(ulong userId);
    Task<bool> VerifyEmailAsync(VerifyEmailRequest request);
    Task<bool> ResendOtpAsync(ResendOtpRequest request);
}
