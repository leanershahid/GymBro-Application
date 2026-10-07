using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
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
        // Resolve TenantId — fall back to the first (default) tenant if not provided.
        // The tenant must exist and be active; you can only join a real gym.
        var tenantId = request.TenantId != 0
            ? request.TenantId
            : (await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstOrDefaultAsync());

        var tenantActive = await db.Tenants.AnyAsync(t => t.Id == tenantId && (t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial));
        if (!tenantActive)
            throw new ArgumentException("The selected gym does not exist or is not accepting registrations.");

        // Public self-registration always creates a 'client' account — the role is never
        // taken from the request body, since that would let anyone register as admin/trainer.
        var user = await CreateUserAsync(new NewUser(
            tenantId, BranchId: null, RoleNames.Client,
            request.Email, request.Password, request.FirstName, request.LastName, UserStatus.Pending));

        return user is null ? null : GenerateTokens(user, RoleNames.Client);
    }

    public async Task<User?> CreateUserAsync(NewUser spec)
    {
        // Email is the login key, so it stays unique across all tenants.
        var exists = await db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.Email != null && u.Email.ToLower() == spec.Email.ToLower() && u.DeletedAt == null);
        if (exists) return null;

        if (spec.BranchId is { } branchId)
        {
            var branchOk = await db.Branches.IgnoreQueryFilters()
                .AnyAsync(b => b.Id == branchId && b.TenantId == spec.TenantId);
            if (!branchOk)
                throw new ArgumentException($"Branch {branchId} does not belong to tenant {spec.TenantId}.");
        }

        // Role must belong to the same tenant — never borrow another tenant's role.
        var role = await db.Roles.IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Slug == spec.RoleSlug && r.TenantId == spec.TenantId)
            ?? throw new InvalidOperationException(
                $"Tenant {spec.TenantId} has no '{spec.RoleSlug}' role. Ensure the tenant was provisioned.");

        var user = new User
        {
            Uuid         = Guid.NewGuid().ToString(),
            Email        = spec.Email,
            PasswordHash = PasswordHasher.Hash(spec.Password),
            FirstName    = spec.FirstName,
            LastName     = spec.LastName,
            RoleId       = role.Id,
            TenantId     = spec.TenantId,
            BranchId     = spec.BranchId,
            Status       = spec.Status,
            CreatedAt    = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(); // Id assigned by AppDbContext
        return user;
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        // Find user by email only — don't join Role here,
        // a broken RoleId FK would cause Include to fail or return null
        var user = await db.Users
            .FirstOrDefaultAsync(u =>
                u.Email != null &&
                u.Email.ToLower() == request.Email.ToLower() &&
                u.DeletedAt == null);

        if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash, out var needsRehash))
            return null;

        // Upgrade legacy unsalted hashes transparently.
        if (needsRehash) user.PasswordHash = PasswordHasher.Hash(request.Password);

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

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        _passwordResetTokens.Remove(request.Token);
        return true;
    }

    public async Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || !PasswordHasher.Verify(request.CurrentPassword, user.PasswordHash, out _)) return false;

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
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
            TenantId        = user.TenantId,
            BranchId        = user.BranchId,
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
            TenantId     = user.TenantId,
            BranchId     = user.BranchId,
            Email        = user.Email ?? string.Empty
        };
    }

    private string CreateJwt(User user, string roleSlug, DateTime expiry)
    {
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Role,               roleSlug),
            new(CustomClaims.TenantId,         user.TenantId.ToString()),
            new(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };
        if (user.BranchId is { } branchId)
            claims.Add(new Claim(CustomClaims.BranchId, branchId.ToString()));
        var token = new JwtSecurityToken(
            issuer:            _jwt.Issuer,
            audience:          _jwt.Audience,
            claims:            claims,
            expires:           expiry,
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
}
