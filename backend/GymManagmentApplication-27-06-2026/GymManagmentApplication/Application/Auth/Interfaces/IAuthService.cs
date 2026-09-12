using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Responses;

namespace GymManagmentApplication.Application.Auth.Interfaces;

public interface IAuthService
{
    Task<AuthResponse?> RegisterAsync(RegisterRequest request);
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
