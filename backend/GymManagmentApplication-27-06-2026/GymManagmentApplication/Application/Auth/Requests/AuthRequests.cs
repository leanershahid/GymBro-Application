namespace GymManagmentApplication.Application.Auth.Requests;

public class RegisterRequest
{
    public string Email { get; set; } = default!;
    public string Password { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public ulong TenantId { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; } = default!;
    public string Password { get; set; } = default!;
}

public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = default!;
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = default!;
}

public class ResetPasswordRequest
{
    public string Token { get; set; } = default!;
    public string NewPassword { get; set; } = default!;
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = default!;
    public string NewPassword { get; set; } = default!;
}

public class VerifyEmailRequest
{
    public string Email { get; set; } = default!;
    public string Otp { get; set; } = default!;
}

public class ResendOtpRequest
{
    public string Email { get; set; } = default!;
    public string Channel { get; set; } = "email"; // email or sms
}
