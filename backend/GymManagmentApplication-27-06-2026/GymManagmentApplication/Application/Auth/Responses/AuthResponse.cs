namespace GymManagmentApplication.Application.Auth.Responses;

public class AuthResponse
{
    public string AccessToken { get; set; } = default!;
    public string RefreshToken { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public string Role { get; set; } = default!;
    public ulong UserId { get; set; }
    public string Email { get; set; } = default!;
}

public class UserProfileResponse
{
    public ulong UserId { get; set; }
    public string Email { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string Role { get; set; } = default!;
    public bool IsEmailVerified { get; set; }
}
