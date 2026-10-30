namespace GymManagmentApplication.Domain.Entities.Identity;

public enum AuthCodePurpose
{
    PasswordReset = 1,
    EmailVerification = 2,
}

/// <summary>
/// One-time 6-digit code sent by email (password reset, email verification). Only a hash is
/// stored; a code is single-use, expires, and is burnt after <c>MaxAttempts</c> wrong guesses.
/// </summary>
public class AuthCode
{
    public const int MaxAttempts = 5;

    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public AuthCodePurpose Purpose { get; set; }
    public string CodeHash { get; set; } = default!;
    public int Attempts { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
}
