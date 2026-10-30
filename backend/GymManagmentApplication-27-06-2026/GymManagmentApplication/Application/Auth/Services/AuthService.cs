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
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace GymManagmentApplication.Application.Auth.Services;

public class AuthService(IOptions<JwtSettings> jwtOptions, AppDbContext db, IEmailSender email) : IAuthService
{
    private readonly JwtSettings _jwt = jwtOptions.Value;

    // Sign-in lockout: this many wrong passwords in a row lock the account for LockoutFor.
    private const int MaxFailedLogins = 5;
    private static readonly TimeSpan LockoutFor = TimeSpan.FromMinutes(15);
    private const int CodeValidMinutes = 15;

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // Self-registration must name an active gym — never default into the platform tenant.
        var tenantActive = request.TenantId != 0 && await db.Tenants.AnyAsync(t =>
            t.Id == request.TenantId && (t.Status == TenantStatus.Active || t.Status == TenantStatus.Trial));
        if (!tenantActive)
            throw new ArgumentException("The selected gym does not exist or is not accepting registrations.");

        // Public self-registration always creates a 'client' account — the role is never
        // taken from the request body, since that would let anyone register as admin/trainer.
        // The account stays Pending (cannot sign in) until the emailed code is verified.
        var user = await CreateUserAsync(new NewUser(
            request.TenantId, BranchId: null, RoleNames.Client,
            request.Email, request.Password, request.FirstName, request.LastName, UserStatus.Pending));
        if (user is null) return null;

        await SendCodeAsync(user, AuthCodePurpose.EmailVerification);
        return new AuthResponse { UserId = user.Id, TenantId = user.TenantId, Email = user.Email ?? string.Empty, Role = RoleNames.Client };
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

    public async Task<AuthResponse?> LoginAsync(LoginRequest request, SessionInfo? session = null)
    {
        // Find user by email only — don't join Role here,
        // a broken RoleId FK would cause Include to fail or return null
        var user = await db.Users
            .FirstOrDefaultAsync(u =>
                u.Email != null &&
                u.Email.ToLower() == request.Email.ToLower() &&
                u.DeletedAt == null);
        if (user is null) return null;

        if (user.LockedUntil is { } until && until > DateTime.UtcNow)
            throw new UnauthorizedAccessException(
                $"Too many failed sign-in attempts. Try again in {Math.Ceiling((until - DateTime.UtcNow).TotalMinutes)} minute(s) or reset your password.");

        if (!PasswordHasher.Verify(request.Password, user.PasswordHash, out var needsRehash))
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedLogins)
            {
                user.LockedUntil = DateTime.UtcNow.Add(LockoutFor);
                user.FailedLoginCount = 0;
            }
            await db.SaveChangesAsync();
            return null;
        }

        await EnsureCanSignInAsync(user);

        // Upgrade legacy unsalted hashes transparently.
        if (needsRehash) user.PasswordHash = PasswordHasher.Hash(request.Password);

        // Load role separately so a missing/0 RoleId doesn't block login
        var roleSlug = await ResolveRoleSlugAsync(user);

        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.LastLoginAt = DateTime.UtcNow;
        user.LoginCount++;
        user.UpdatedAt = DateTime.UtcNow;
        var tokens = await IssueTokensAsync(user, roleSlug, session);
        await db.SaveChangesAsync();
        return tokens;
    }

    /// <summary>Ends one device's session (its refresh token). The short-lived access token simply expires.</summary>
    public async Task LogoutAsync(ulong userId, string? refreshToken)
    {
        if (string.IsNullOrEmpty(refreshToken)) return;
        var hash = Sha256(refreshToken);
        await db.UserSessions.Where(s => s.UserId == userId && s.TokenHash == hash).ExecuteDeleteAsync();
    }

    /// <summary>Rotates the refresh token: the old one is consumed, a new pair is issued.</summary>
    public async Task<AuthResponse?> RefreshAsync(string refreshToken, SessionInfo? session = null)
    {
        if (string.IsNullOrEmpty(refreshToken)) return null;
        var hash = Sha256(refreshToken);
        var stored = await db.UserSessions.FirstOrDefaultAsync(s => s.TokenHash == hash);
        if (stored is null) return null;
        db.UserSessions.Remove(stored);
        if (stored.ExpiresAt < DateTime.UtcNow) { await db.SaveChangesAsync(); return null; }

        var user = await db.Users.IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == stored.UserId && u.DeletedAt == null);
        if (user is null) { await db.SaveChangesAsync(); return null; }

        await EnsureCanSignInAsync(user);
        var roleSlug = await ResolveRoleSlugAsync(user);
        var tokens = await IssueTokensAsync(user, roleSlug,
            session ?? new SessionInfo(stored.IpAddress, stored.UserAgent, stored.DeviceType));
        await db.SaveChangesAsync();
        return tokens;
    }

    public async Task<bool> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var user = await FindByEmailAsync(request.Email);
        // Always "succeeds" so the response never reveals whether an account exists.
        if (user is null || user.Status is UserStatus.Suspended or UserStatus.Inactive) return true;
        await SendCodeAsync(user, AuthCodePurpose.PasswordReset);
        return true;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request)
    {
        var user = await FindByEmailAsync(request.Email);
        if (user is null || !await ConsumeCodeAsync(user.Id, AuthCodePurpose.PasswordReset, request.Code)) return false;

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        // Receiving the code proves the mailbox, so a pending self-registration is verified too.
        user.EmailVerifiedAt ??= DateTime.UtcNow;
        if (user.Status == UserStatus.Pending) user.Status = UserStatus.Active;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, user.Id); // sign out every device
        return true;
    }

    public async Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null || !PasswordHasher.Verify(request.CurrentPassword, user.PasswordHash, out _)) return false;

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, user.Id); // every device, this one included, signs in again
        return true;
    }

    public async Task<UserProfileResponse?> GetMeAsync(ulong userId)
    {
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Id == userId && u.DeletedAt == null);

        if (user is null) return null;

        var roleSlug = await ResolveRoleSlugAsync(user);

        return new UserProfileResponse
        {
            UserId          = user.Id,
            Email           = user.Email ?? string.Empty,
            FirstName       = user.FirstName ?? string.Empty,
            LastName        = user.LastName ?? string.Empty,
            Role            = roleSlug,
            TenantId        = user.TenantId,
            BranchId        = user.BranchId,
            IsEmailVerified = user.EmailVerifiedAt.HasValue,
            Phone           = user.Phone,
            AvatarUrl       = user.AvatarUrl
        };
    }

    public async Task<bool> VerifyEmailAsync(VerifyEmailRequest request)
    {
        var user = await FindByEmailAsync(request.Email);
        if (user is null || !await ConsumeCodeAsync(user.Id, AuthCodePurpose.EmailVerification, request.Otp)) return false;

        user.EmailVerifiedAt = DateTime.UtcNow;
        if (user.Status == UserStatus.Pending) user.Status = UserStatus.Active;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ResendOtpAsync(ResendOtpRequest request)
    {
        var user = await FindByEmailAsync(request.Email);
        // Neutral result either way — never reveal whether the email is registered.
        if (user is not null && user.EmailVerifiedAt is null)
            await SendCodeAsync(user, AuthCodePurpose.EmailVerification);
        return true;
    }

    private Task<User?> FindByEmailAsync(string email) =>
        db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u =>
            u.Email != null && u.Email.ToLower() == email.ToLower() && u.DeletedAt == null);

    /// <summary>Replaces any open code for this purpose with a fresh one and emails it.</summary>
    private async Task SendCodeAsync(User user, AuthCodePurpose purpose)
    {
        await db.AuthCodes.Where(c => c.UserId == user.Id && c.Purpose == purpose).ExecuteDeleteAsync();
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        db.AuthCodes.Add(new AuthCode
        {
            UserId = user.Id, Purpose = purpose, CodeHash = Sha256($"{user.Id}:{code}"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(CodeValidMinutes),
        });
        await db.SaveChangesAsync();

        if (string.IsNullOrEmpty(user.Email)) return;
        var (subject, heading, intro) = purpose == AuthCodePurpose.PasswordReset
            ? ("Your GymBro password reset code", "Reset your password", "Use this code in the app to set a new password:")
            : ("Verify your GymBro email", "Verify your email", "Use this code in the app to verify your email address:");
        await email.SendAsync(user.Email, subject, EmailTemplates.Code(heading, intro, code, CodeValidMinutes));
    }

    /// <summary>True (and the code is marked used) if it matches; wrong guesses count against MaxAttempts.</summary>
    private async Task<bool> ConsumeCodeAsync(ulong userId, AuthCodePurpose purpose, string code)
    {
        var row = await db.AuthCodes
            .Where(c => c.UserId == userId && c.Purpose == purpose && c.UsedAt == null)
            .OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync();
        if (row is null || row.ExpiresAt < DateTime.UtcNow || row.Attempts >= AuthCode.MaxAttempts) return false;

        var expected = Encoding.UTF8.GetBytes(row.CodeHash);
        var actual = Encoding.UTF8.GetBytes(Sha256($"{userId}:{(code ?? string.Empty).Trim()}"));
        if (!CryptographicOperations.FixedTimeEquals(expected, actual))
        {
            row.Attempts++;
            await db.SaveChangesAsync();
            return false;
        }
        row.UsedAt = DateTime.UtcNow; // saved together with the caller's changes
        return true;
    }

    /// <summary>
    /// The user's role slug — only if the role row belongs to the user's own tenant. A RoleId
    /// pointing at another gym's role is treated as a plain client.
    /// </summary>
    private async Task<string> ResolveRoleSlugAsync(User user)
    {
        if (user.RoleId == 0) return RoleNames.Client;
        var slug = await db.Roles.IgnoreQueryFilters()
            .Where(r => r.Id == user.RoleId && r.TenantId == user.TenantId)
            .Select(r => r.Slug).FirstOrDefaultAsync();
        return slug ?? RoleNames.Client;
    }

    /// <summary>
    /// Suspended/deactivated accounts, and every account of a suspended or cancelled gym,
    /// cannot sign in or refresh. Pending (self-registered) accounts must verify their email first.
    /// </summary>
    private async Task EnsureCanSignInAsync(User user)
    {
        if (user.Status == UserStatus.Pending)
            throw new UnauthorizedAccessException("Please verify your email first — enter the code we sent you.");
        if (user.Status is UserStatus.Suspended or UserStatus.Inactive)
            throw new UnauthorizedAccessException("This account has been deactivated. Please contact your gym.");

        var tenantStatus = await db.Tenants.Where(t => t.Id == user.TenantId).Select(t => t.Status).FirstOrDefaultAsync();
        if (tenantStatus is TenantStatus.Suspended or TenantStatus.Cancelled)
            throw new UnauthorizedAccessException("This gym's account is not active. Please contact support.");
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, string roleSlug, SessionInfo? session)
    {
        var expiry = DateTime.UtcNow.AddMinutes(_jwt.AccessTokenExpiryMinutes);
        var accessToken = CreateJwt(user, roleSlug, expiry);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        // Refresh tokens live in the database (hashed), so they survive restarts and work across instances.
        await db.UserSessions.Where(s => s.UserId == user.Id && s.ExpiresAt < DateTime.UtcNow).ExecuteDeleteAsync();
        db.UserSessions.Add(new UserSession
        {
            UserId     = user.Id,
            TokenHash  = Sha256(refreshToken),
            IpAddress  = Truncate(session?.IpAddress, 64),
            UserAgent  = Truncate(session?.UserAgent, 255),
            DeviceType = session?.DeviceType ?? DeviceType.Web,
            ExpiresAt  = DateTime.UtcNow.AddDays(_jwt.RefreshTokenExpiryDays),
        });

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

    private static string? Truncate(string? v, int max) => v is null || v.Length <= max ? v : v[..max];

    private static string Sha256(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

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
            new(CustomClaims.TokenVersion,     user.TokenVersion.ToString()),
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

}
