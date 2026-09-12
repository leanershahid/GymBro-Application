using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace GymManagmentApplication.Application.Auth.Services;

public class AuthService(IOptions<JwtSettings> jwtOptions, AppDbContext db) : IAuthService
{
    private readonly JwtSettings _jwt = jwtOptions.Value;

    // In-memory stores for refresh/reset tokens and OTPs (stateless; replace with DB-backed if needed)
    private static readonly Dictionary<string, (ulong UserId, DateTime Expiry)> _refreshTokens = [];
    private static readonly Dictionary<string, (ulong UserId, DateTime Expiry)> _passwordResetTokens = [];
    private static readonly Dictionary<string, (string Otp, DateTime Expiry)> _otpStore = [];

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // Reject if email already exists
        var exists = await db.Users
            .AnyAsync(u => u.Email != null && u.Email.ToLower() == request.Email.ToLower() && u.DeletedAt == null);
        if (exists) return null;

        // Resolve TenantId — fall back to the first (default) tenant if not provided
        var tenantId = request.TenantId != 0
            ? request.TenantId
            : (await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstOrDefaultAsync());

        if (tenantId == 0)
            throw new InvalidOperationException("No tenant found. Ensure the database is seeded.");

        // Public self-registration always creates a 'client' account — the role is never
        // taken from the request body, since that would let anyone register as admin/trainer.
        // Admin/trainer accounts are created via the authenticated TrainerController/RolesController flows.
        const string roleSlug = "client";
        var role = await db.Roles
            .FirstOrDefaultAsync(r => r.Slug == roleSlug && r.TenantId == tenantId)
            ?? await db.Roles.FirstOrDefaultAsync(r => r.Slug == "client");

        if (role is null)
            throw new InvalidOperationException("No roles found. Ensure the database is seeded.");

        // Generate Id in application code — DB uses numeric(20,0) with no identity strategy
        var maxId = await db.Users.MaxAsync(u => (ulong?)u.Id) ?? 0UL;
        var newId = maxId + 1;

        var user = new User
        {
            Id           = newId,
            Uuid         = Guid.NewGuid().ToString(),
            Email        = request.Email,
            PasswordHash = Hash(request.Password),
            FirstName    = request.FirstName,
            LastName     = request.LastName,
            RoleId       = role.Id,
            TenantId     = tenantId,
            Status       = UserStatus.Pending,
            CreatedAt    = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return GenerateTokens(user, roleSlug);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var passwordHash = Hash(request.Password);

        // Find user by email + password only — don't join Role here,
        // a broken RoleId FK would cause Include to fail or return null
        var user = await db.Users
            .FirstOrDefaultAsync(u =>
                u.Email != null &&
                u.Email.ToLower() == request.Email.ToLower() &&
                u.PasswordHash == passwordHash &&
                u.DeletedAt == null);

        if (user is null) return null;

        // Load role separately so a missing/0 RoleId doesn't block login
        var role = user.RoleId != 0
            ? await db.Roles.FirstOrDefaultAsync(r => r.Id == user.RoleId)
            : null;
        var roleSlug = role?.Slug ?? "client";

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        user.LoginCount++;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return GenerateTokens(user, roleSlug);
    }

    public Task LogoutAsync(ulong userId)
    {
        var keys = _refreshTokens.Where(kv => kv.Value.UserId == userId).Select(kv => kv.Key).ToList();
        foreach (var k in keys) _refreshTokens.Remove(k);
        return Task.CompletedTask;
    }

    public async Task<AuthResponse?> RefreshAsync(string refreshToken)
    {
        if (!_refreshTokens.TryGetValue(refreshToken, out var entry) || entry.Expiry < DateTime.UtcNow)
            return null;

        _refreshTokens.Remove(refreshToken);

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == entry.UserId && u.DeletedAt == null);

        if (user is null) return null;

        var role = user.RoleId != 0
            ? await db.Roles.FirstOrDefaultAsync(r => r.Id == user.RoleId)
            : null;
        var roleSlug = role?.Slug ?? "client";
        return GenerateTokens(user, roleSlug);
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == request.Email.ToLower() && u.DeletedAt == null);
        if (user is null) return false;

        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        _passwordResetTokens[token] = (user.Id, DateTime.UtcNow.AddHours(1));
        // In production: send token via email
        return true;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        if (!_passwordResetTokens.TryGetValue(request.Token, out var entry) || entry.Expiry < DateTime.UtcNow)
            return false;

        var user = await db.Users.FindAsync(entry.UserId);
        if (user is null) return false;

        user.PasswordHash = Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        _passwordResetTokens.Remove(request.Token);
        return true;
    }

    public async Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || user.PasswordHash != Hash(request.CurrentPassword)) return false;

        user.PasswordHash = Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<UserProfileResponse?> GetMeAsync(ulong userId)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null);

        if (user is null) return null;

        var role = user.RoleId != 0
            ? await db.Roles.FirstOrDefaultAsync(r => r.Id == user.RoleId)
            : null;

        return new UserProfileResponse
        {
            UserId          = user.Id,
            Email           = user.Email ?? string.Empty,
            FirstName       = user.FirstName ?? string.Empty,
            LastName        = user.LastName ?? string.Empty,
            Role            = role?.Slug ?? "client",
            IsEmailVerified = user.EmailVerifiedAt.HasValue
        };
    }

    public async Task<bool> VerifyEmailAsync(VerifyEmailRequest request)
    {
        if (!_otpStore.TryGetValue(request.Email, out var entry) || entry.Expiry < DateTime.UtcNow || entry.Otp != request.Otp)
            return false;

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == request.Email.ToLower() && u.DeletedAt == null);
        if (user is null) return false;

        user.EmailVerifiedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        _otpStore.Remove(request.Email);
        return true;
    }

    public async Task<bool> ResendOtpAsync(ResendOtpRequest request)
    {
        var exists = await db.Users
            .AnyAsync(u => u.Email != null && u.Email.ToLower() == request.Email.ToLower() && u.DeletedAt == null);
        if (!exists) return false;

        var otp = Random.Shared.Next(100000, 999999).ToString();
        _otpStore[request.Email] = (otp, DateTime.UtcNow.AddMinutes(10));
        // In production: send via email/SMS based on request.Channel
        return true;
    }

    private AuthResponse GenerateTokens(User user, string roleSlug)
    {
        var expiry = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenExpiryMinutes);
        var accessToken = CreateJwt(user, roleSlug, expiry);
        var refreshToken = GenerateRefreshToken();
        _refreshTokens[refreshToken] = (user.Id, DateTime.UtcNow.AddDays(_jwt.RefreshTokenExpiryDays));
        return new AuthResponse
        {
            AccessToken  = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt    = expiry,
            Role         = roleSlug,
            UserId       = user.Id,
            Email        = user.Email ?? string.Empty
        };
    }

    private string CreateJwt(User user, string roleSlug, DateTime expiry)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(ClaimTypes.Role,               roleSlug),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };
        var token = new JwtSecurityToken(
            issuer:            _jwt.Issuer,
            audience:          _jwt.Audience,
            claims:            claims,
            expires:           expiry,
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    private static string Hash(string input) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
}
