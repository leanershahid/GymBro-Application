using System.IdentityModel.Tokens.Jwt;
using System.Text;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Auth.TwoFactor;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace GymManagmentApplication.Tests;

/// <summary>RFC 6238 maths (no database).</summary>
public class TotpTests
{
    // RFC 6238 Appendix B: the seeds are ASCII "1234567890" repeated to the hash's key length, 8 digits.
    private static readonly byte[] Sha1Key = Encoding.ASCII.GetBytes("12345678901234567890");
    private static readonly byte[] Sha256Key = Encoding.ASCII.GetBytes("12345678901234567890123456789012");
    private static readonly byte[] Sha512Key = Encoding.ASCII.GetBytes("1234567890123456789012345678901234567890123456789012345678901234");

    [Theory]
    [InlineData(59L, "94287082", "46119246", "90693936")]
    [InlineData(1111111109L, "07081804", "68084774", "25091201")]
    [InlineData(1111111111L, "14050471", "67062674", "99943326")]
    [InlineData(1234567890L, "89005924", "91819424", "93441116")]
    [InlineData(2000000000L, "69279037", "90698825", "38618901")]
    [InlineData(20000000000L, "65353130", "77737706", "47863826")]
    public void Rfc6238_test_vectors(long unixTime, string sha1, string sha256, string sha512)
    {
        var step = Totp.TimeStep(DateTimeOffset.FromUnixTimeSeconds(unixTime));
        Assert.Equal(sha1, Totp.Compute(Sha1Key, step, 8, Totp.Algorithm.Sha1));
        Assert.Equal(sha256, Totp.Compute(Sha256Key, step, 8, Totp.Algorithm.Sha256));
        Assert.Equal(sha512, Totp.Compute(Sha512Key, step, 8, Totp.Algorithm.Sha512));
    }

    [Fact]
    public void Rfc4226_hotp_vectors_6_digits()
    {
        string[] expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
        for (var i = 0; i < expected.Length; i++) Assert.Equal(expected[i], Totp.Compute(Sha1Key, i));
    }

    [Fact]
    public void Accepts_one_step_either_side_but_not_two()
    {
        var key = Totp.NewSecret();
        var now = DateTimeOffset.FromUnixTimeSeconds(1_700_000_000);
        var step = Totp.TimeStep(now);
        Assert.Equal(step, Totp.Verify(key, Totp.Compute(key, step), now));
        Assert.Equal(step - 1, Totp.Verify(key, Totp.Compute(key, step - 1), now));
        Assert.Equal(step + 1, Totp.Verify(key, Totp.Compute(key, step + 1), now));
        Assert.Null(Totp.Verify(key, Totp.Compute(key, step - 2), now));
        Assert.Null(Totp.Verify(key, Totp.Compute(key, step + 2), now));
        Assert.Null(Totp.Verify(key, "12345", now));
        Assert.Equal(step, Totp.Verify(key, Totp.Compute(key, step).Insert(3, " "), now)); // "123 456"
    }

    [Fact]
    public void A_code_is_not_accepted_twice()
    {
        var key = Totp.NewSecret();
        var now = DateTimeOffset.UtcNow;
        var code = Totp.Compute(key, Totp.TimeStep(now));
        var used = Totp.Verify(key, code, now);
        Assert.NotNull(used);
        Assert.Null(Totp.Verify(key, code, now, lastUsedStep: used!.Value));
    }

    [Fact]
    public void Base32_round_trips_and_matches_rfc4648()
    {
        Assert.Equal("MZXW6YTBOI", Totp.ToBase32(Encoding.ASCII.GetBytes("foobar")));
        var key = Totp.NewSecret();
        Assert.Equal(key, Totp.FromBase32(Totp.ToBase32(key)));
        Assert.Equal(key, Totp.FromBase32(Totp.Group(Totp.ToBase32(key)).ToLowerInvariant()));
        Assert.StartsWith("otpauth://totp/GymBro:a%40b.com?secret=", Totp.OtpAuthUri("GymBro", "a@b.com", "ABC"));
    }
}

/// <summary>Enrolment, the login challenge, recovery codes, remembered devices and the gym policy (feature 10).</summary>
public class TwoFactorFlowTests : IDisposable
{
    private const string Password = "Passw0rd!";
    private const ulong Member = 100, Admin = 1, Trainer = 2, OtherAdmin = 3;
    private readonly TestDb _db = new();
    private readonly IMemoryCache _cache = new MemoryCache(new MemoryCacheOptions());
    private readonly FakeEmail _email = new();
    private readonly ISecretProtector _secrets = new SecretProtector(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?> { ["Secrets:Key"] = "test-key" }).Build());
    private static readonly SessionInfo Device = new("10.0.0.1", "test-agent");

    public TwoFactorFlowTests()
    {
        _db.SeedGym(1);
        using (var db = _db.Create(null))
        {
            db.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 13, TenantId = 1, Name = "Trainer", Slug = "trainer" });
            db.SaveChanges();
        }
        AddUser(Member, 11);
        AddUser(Admin, 12);
        AddUser(OtherAdmin, 12);
        AddUser(Trainer, 13);
    }

    public void Dispose() { _db.Dispose(); _cache.Dispose(); }

    private void AddUser(ulong id, ulong roleId)
    {
        using var db = _db.Create(null);
        db.Users.Add(new User
        {
            Id = id, TenantId = 1, RoleId = roleId, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
            PasswordHash = PasswordHasher.Hash(Password), Status = Domain.Enums.UserStatus.Active,
        });
        db.SaveChanges();
    }

    private sealed class FakeEmail : IEmailSender
    {
        public readonly List<(string To, string Body)> Sent = [];
        public Task<bool> SendAsync(string to, string subject, string htmlBody, IReadOnlyList<(string Name, byte[] Content, string MediaType)>? attachments = null)
        { Sent.Add((to, htmlBody)); return Task.FromResult(true); }
    }

    // Each call is its own "request": a fresh DbContext, shared cache.
    private AppDbContext Db() => _db.Create(null);
    private TwoFactorService Tfa(AppDbContext db) => new(db, _secrets, NullLogger<TwoFactorService>.Instance);
    private AuthService Auth(AppDbContext db) => new(
        Options.Create(new JwtSettings { Key = "test-signing-key-test-signing-key-0123456789", Issuer = "t", Audience = "t" }),
        db, _email, _cache, NullLogger<AuthService>.Instance, Tfa(db));

    private static string Now(string secret, int offsetSteps = 0) =>
        Totp.Compute(Totp.FromBase32(secret), Totp.TimeStep(DateTimeOffset.UtcNow) + offsetSteps);

    /// <summary>Turns 2FA on for a user (confirming with the previous step's code, so the current one is still unused).</summary>
    private async Task<(string Secret, List<string> Recovery)> EnrolAsync(ulong userId)
    {
        using var db = Db();
        var setup = await Tfa(db).BeginSetupAsync(userId);
        var codes = await Tfa(db).EnableAsync(userId, Now(setup.Secret, -1));
        Assert.NotNull(codes);
        return (setup.Secret, codes!.RecoveryCodes);
    }

    private async Task<Application.Auth.Responses.AuthResponse> LoginAsync(ulong userId, string? deviceToken = null)
    {
        using var db = Db();
        var res = await Auth(db).LoginAsync(new LoginRequest { Email = $"u{userId}@test.local", Password = Password, DeviceToken = deviceToken }, Device);
        Assert.NotNull(res);
        return res!;
    }

    private async Task<TwoFactorVerifyResult> VerifyAsync(string challenge, string code, string method = "totp", bool remember = false)
    {
        using var db = Db();
        return await Auth(db).VerifyTwoFactorAsync(new TwoFactorVerifyRequest
        { ChallengeToken = challenge, Code = code, Method = method, RememberDevice = remember }, Device);
    }

    [Fact]
    public async Task Without_2fa_login_issues_tokens_as_before()
    {
        var res = await LoginAsync(Member);
        Assert.False(res.RequiresTwoFactor);
        Assert.False(string.IsNullOrEmpty(res.AccessToken));
        Assert.False(res.TwoFactorSetupRequired); // members are never required
    }

    [Fact]
    public async Task Enrolment_stores_the_secret_encrypted_and_ten_hashed_recovery_codes()
    {
        var (secret, recovery) = await EnrolAsync(Member);
        Assert.Equal(10, recovery.Count);
        Assert.Equal(10, recovery.Distinct().Count());
        using var db = Db();
        var row = await db.UserTwoFactors.SingleAsync(x => x.UserId == Member);
        Assert.NotNull(row.EnabledAt);
        Assert.DoesNotContain(secret, row.SecretProtected);
        Assert.Equal(secret, _secrets.Unprotect(row.SecretProtected));
        var hashes = await db.TwoFactorRecoveryCodes.Where(c => c.UserId == Member).Select(c => c.CodeHash).ToListAsync();
        Assert.Equal(10, hashes.Count);
        Assert.DoesNotContain(hashes, h => recovery.Any(r => h.Contains(r.Replace("-", ""), StringComparison.OrdinalIgnoreCase)));
    }

    [Fact]
    public async Task Enable_rejects_a_wrong_code()
    {
        using var db = Db();
        var setup = await Tfa(db).BeginSetupAsync(Member);
        var wrong = Now(setup.Secret) == "000000" ? "111111" : "000000";
        Assert.Null(await Tfa(db).EnableAsync(Member, wrong));
        Assert.False(await Tfa(db).IsEnabledAsync(Member));
    }

    [Fact]
    public async Task Login_with_2fa_returns_a_challenge_and_no_tokens_then_verify_issues_them()
    {
        var (secret, _) = await EnrolAsync(Member);
        var res = await LoginAsync(Member);
        Assert.True(res.RequiresTwoFactor);
        Assert.Null(res.AccessToken);
        Assert.Null(res.RefreshToken);
        Assert.NotNull(res.ChallengeToken);
        Assert.Equal(["totp", "email", "recovery"], res.Methods);
        Assert.True(res.ChallengeExpiresAt <= DateTime.UtcNow.AddMinutes(5.1));

        var ok = await VerifyAsync(res.ChallengeToken!, Now(secret));
        Assert.NotNull(ok.Tokens);
        Assert.False(string.IsNullOrEmpty(ok.Tokens!.AccessToken));
        Assert.Null(ok.Tokens.DeviceToken);
    }

    [Fact]
    public async Task A_challenge_is_single_use()
    {
        var (secret, _) = await EnrolAsync(Member);
        var res = await LoginAsync(Member);
        Assert.NotNull((await VerifyAsync(res.ChallengeToken!, Now(secret))).Tokens);
        var again = await VerifyAsync(res.ChallengeToken!, Now(secret, 1));
        Assert.Null(again.Tokens);
        Assert.True(again.ChallengeEnded);
    }

    [Fact]
    public async Task An_expired_challenge_is_refused()
    {
        var (secret, _) = await EnrolAsync(Member);
        var res = await LoginAsync(Member);
        using (var db = Db())
            await db.TwoFactorChallenges.ExecuteUpdateAsync(s => s.SetProperty(c => c.ExpiresAt, DateTime.UtcNow.AddSeconds(-1)));
        var r = await VerifyAsync(res.ChallengeToken!, Now(secret));
        Assert.Null(r.Tokens);
        Assert.True(r.ChallengeEnded);

        using var db2 = Db();
        Assert.Null(await Tfa(db2).FindOpenChallengeAsync(res.ChallengeToken, DateTime.UtcNow));
    }

    [Fact]
    public async Task Five_wrong_codes_burn_the_challenge_and_count_against_the_login_lockout()
    {
        var (secret, _) = await EnrolAsync(Member);
        var res = await LoginAsync(Member);
        var right = Now(secret);
        var wrong = right == "000000" ? "111111" : "000000";
        for (var i = 1; i <= 4; i++)
        {
            var r = await VerifyAsync(res.ChallengeToken!, wrong);
            Assert.False(r.ChallengeEnded);
            Assert.Equal(5 - i, r.AttemptsRemaining);
        }
        Assert.True((await VerifyAsync(res.ChallengeToken!, wrong)).ChallengeEnded);
        // Even the right code no longer works on that challenge…
        var after = await VerifyAsync(res.ChallengeToken!, right);
        Assert.Null(after.Tokens);
        Assert.True(after.ChallengeEnded);
        // …and the same email+IP counter as wrong passwords now blocks signing in again.
        using var db = Db();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            Auth(db).LoginAsync(new LoginRequest { Email = $"u{Member}@test.local", Password = Password }, Device));
        Assert.Equal(5, (await db.Users.SingleAsync(u => u.Id == Member)).FailedLoginCount);
    }

    [Fact]
    public async Task A_totp_code_cannot_be_replayed_on_a_new_challenge()
    {
        var (secret, _) = await EnrolAsync(Member);
        var code = Now(secret);
        Assert.NotNull((await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, code)).Tokens);
        Assert.Null((await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, code)).Tokens);
    }

    [Fact]
    public async Task Recovery_codes_work_once()
    {
        var (_, recovery) = await EnrolAsync(Member);
        var ok = await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, recovery[0].ToUpperInvariant(), "recovery");
        Assert.NotNull(ok.Tokens);
        var reused = await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, recovery[0], "recovery");
        Assert.Null(reused.Tokens);
        Assert.NotNull((await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, recovery[1], "recovery")).Tokens);

        using var db = Db();
        Assert.Equal(8, (await Tfa(db).GetStatusAsync(Member)).RecoveryCodesRemaining);
    }

    [Fact]
    public async Task Regenerating_recovery_codes_invalidates_the_old_ones()
    {
        var (secret, old) = await EnrolAsync(Member);
        using (var db = Db())
            Assert.NotNull(await Tfa(db).RegenerateRecoveryCodesAsync(Member, Now(secret)));
        Assert.Null((await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, old[0], "recovery")).Tokens);
    }

    [Fact]
    public async Task Email_fallback_code_signs_in()
    {
        await EnrolAsync(Member);
        var res = await LoginAsync(Member);
        using (var db = Db()) Assert.True(await Auth(db).SendTwoFactorEmailCodeAsync(res.ChallengeToken!));
        var code = System.Text.RegularExpressions.Regex.Match(_email.Sent.Last().Body, @">(\d{6})<").Groups[1].Value;
        Assert.Equal(6, code.Length);
        Assert.NotNull((await VerifyAsync(res.ChallengeToken!, code, "email")).Tokens);
    }

    [Fact]
    public async Task Remembered_device_skips_the_second_step_until_the_password_changes()
    {
        var (secret, _) = await EnrolAsync(Member);
        var ok = await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, Now(secret), remember: true);
        var deviceToken = ok.Tokens!.DeviceToken;
        Assert.False(string.IsNullOrEmpty(deviceToken));

        var skipped = await LoginAsync(Member, deviceToken);
        Assert.False(skipped.RequiresTwoFactor);
        Assert.False(string.IsNullOrEmpty(skipped.AccessToken));
        Assert.True((await LoginAsync(Member, "not-a-real-token")).RequiresTwoFactor);

        using (var db = Db())
            Assert.True(await Auth(db).ChangePasswordAsync(Member, new ChangePasswordRequest { CurrentPassword = Password, NewPassword = Password }));
        Assert.True((await LoginAsync(Member, deviceToken)).RequiresTwoFactor);
    }

    [Fact]
    public async Task Revoke_all_forgets_remembered_devices()
    {
        var (secret, _) = await EnrolAsync(Member);
        var deviceToken = (await VerifyAsync((await LoginAsync(Member)).ChallengeToken!, Now(secret), remember: true)).Tokens!.DeviceToken;
        using (var db = Db()) await AuthSessions.RevokeAllAsync(db, Member);
        Assert.True((await LoginAsync(Member, deviceToken)).RequiresTwoFactor);
    }

    [Fact]
    public async Task Disable_needs_password_and_code()
    {
        var (secret, _) = await EnrolAsync(Member);
        using var db = Db();
        await Assert.ThrowsAsync<ArgumentException>(() => Tfa(db).DisableAsync(Member, "wrong-password", Now(secret)));
        await Assert.ThrowsAsync<ArgumentException>(() => Tfa(db).DisableAsync(Member, Password, "000000x"));
        await Tfa(db).DisableAsync(Member, Password, Now(secret));
        Assert.False(await Tfa(db).IsEnabledAsync(Member));
        Assert.False((await LoginAsync(Member)).RequiresTwoFactor);
    }

    // ── Policy ────────────────────────────────────────────────────────────────

    [Fact]
    public void Policy_roles()
    {
        var defaults = new TwoFactorPolicySettings();
        Assert.True(TwoFactorService.IsRequiredFor("superadmin", new TwoFactorPolicySettings { RequireForAdmins = false }));
        Assert.True(TwoFactorService.IsRequiredFor("admin", defaults));
        Assert.False(TwoFactorService.IsRequiredFor("trainer", defaults));
        Assert.False(TwoFactorService.IsRequiredFor("client", new TwoFactorPolicySettings { RequireForStaff = true }));
        Assert.True(TwoFactorService.IsRequiredFor("front-desk", new TwoFactorPolicySettings { RequireForStaff = true }));
        Assert.False(TwoFactorService.IsRequiredFor("admin", new TwoFactorPolicySettings { RequireForAdmins = false }));
    }

    [Fact]
    public async Task Admins_get_a_grace_period_then_a_setup_only_token()
    {
        var first = await LoginAsync(Admin);
        Assert.True(first.TwoFactorSetupRequired);
        Assert.False(first.TwoFactorSetupBlocking);
        Assert.InRange(first.TwoFactorGraceEndsAt!.Value, DateTime.UtcNow.AddDays(6.9), DateTime.UtcNow.AddDays(7.1));
        Assert.DoesNotContain(new JwtSecurityTokenHandler().ReadJwtToken(first.AccessToken).Claims, c => c.Type == TwoFactorClaims.SetupRequired);

        // The grace period started at the first sign-in and is not restarted by the next one.
        Assert.Equal(first.TwoFactorGraceEndsAt!.Value, (await LoginAsync(Admin)).TwoFactorGraceEndsAt!.Value, TimeSpan.FromSeconds(1));

        using (var db = Db())
            await db.UserTwoFactors.Where(x => x.UserId == Admin)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.GraceStartedAt, DateTime.UtcNow.AddDays(-8)));
        var late = await LoginAsync(Admin);
        Assert.True(late.TwoFactorSetupBlocking);
        Assert.Contains(new JwtSecurityTokenHandler().ReadJwtToken(late.AccessToken).Claims,
            c => c.Type == TwoFactorClaims.SetupRequired && c.Value == TwoFactorClaims.SetupRequiredValue);

        // Setting up clears it.
        await EnrolAsync(Admin);
        using var db2 = Db();
        var status = await Tfa(db2).GetStatusAsync(Admin);
        Assert.True(status.Enabled);
        Assert.False(status.SetupRequiredNow);
    }

    [Fact]
    public async Task Grace_period_is_configurable_and_staff_can_be_required()
    {
        using (var db = Db())
            await Tfa(db).SavePolicyAsync(1, new TwoFactorPolicySettings { RequireForAdmins = true, RequireForStaff = true, GracePeriodDays = 0 });
        var trainer = await LoginAsync(Trainer);
        Assert.True(trainer.TwoFactorSetupRequired);
        Assert.True(trainer.TwoFactorSetupBlocking); // 0-day grace: setup at once
        Assert.False((await LoginAsync(Member)).TwoFactorSetupRequired);

        using var db2 = Db();
        await Assert.ThrowsAsync<ArgumentException>(() => Tfa(db2).SavePolicyAsync(1, new TwoFactorPolicySettings { GracePeriodDays = 31 }));
    }

    [Fact]
    public async Task Evaluate_with_a_clock_honours_the_grace_boundary()
    {
        using var db = Db();
        var user = await db.Users.SingleAsync(u => u.Id == Admin);
        var t0 = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var s0 = await Tfa(db).EvaluateAsync(user, "admin", t0);
        await db.SaveChangesAsync();
        Assert.False(s0.SetupRequiredNow);
        Assert.False((await Tfa(db).EvaluateAsync(user, "admin", t0.AddDays(7).AddSeconds(-1))).SetupRequiredNow);
        Assert.True((await Tfa(db).EvaluateAsync(user, "admin", t0.AddDays(7))).SetupRequiredNow);
    }

    [Fact]
    public async Task Required_users_cannot_disable()
    {
        var (secret, _) = await EnrolAsync(Admin);
        using var db = Db();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Tfa(db).DisableAsync(Admin, Password, Now(secret)));
    }

    [Fact]
    public async Task Admin_reset_is_audited_signs_out_and_forces_setup_without_new_grace()
    {
        await EnrolAsync(Admin);
        using (var db = Db())
        {
            await Assert.ThrowsAsync<ArgumentException>(() => Tfa(db).AdminResetAsync(Admin, false, Admin, null, null, null));
            await Tfa(db).AdminResetAsync(OtherAdmin, false, Admin, "lost phone", "1.2.3.4", "ua");
        }
        using (var db = Db())
        {
            Assert.False(await Tfa(db).IsEnabledAsync(Admin));
            var log = await db.AuditLogs.SingleAsync(a => a.Action == "two_factor.reset");
            Assert.Equal(Admin, log.EntityId);
            Assert.Equal(OtherAdmin, log.UserId);
            Assert.Equal(1, (await db.Users.SingleAsync(u => u.Id == Admin)).TokenVersion);
        }
        var next = await LoginAsync(Admin);
        Assert.False(next.RequiresTwoFactor);
        Assert.True(next.TwoFactorSetupBlocking);
    }
}
