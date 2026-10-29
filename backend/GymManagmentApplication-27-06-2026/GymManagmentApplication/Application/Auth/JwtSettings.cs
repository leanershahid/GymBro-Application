namespace GymManagmentApplication.Application.Auth;

public class JwtSettings
{
    public string Key { get; set; } = default!;
    public string Issuer { get; set; } = default!;
    public string Audience { get; set; } = default!;
    public int AccessTokenExpiryMinutes { get; set; } = 15; // short: the app refreshes silently
    public int RefreshTokenExpiryDays { get; set; } = 7;
}
