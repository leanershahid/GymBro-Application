using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.TwoFactor;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Privacy;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Privacy;

/// <summary>
/// Privacy controls (roadmap feature 2; needed for App Store review and India's DPDP Act):
/// <list type="bullet">
///   <item>member: overview, delete my account (re-auth, 7–30 day grace, "Keep my account"), download my data;</item>
///   <item>admin (<c>privacy</c> module, admin only): requests list, process now / cancel, delete from member detail, settings.</item>
/// </list>
/// Consents stay with feature 1 (<c>ConsentService</c>, api/consents/me). The heavy lifting is <see cref="PrivacyProcessor"/>.
/// </summary>
public class PrivacyService(IAppDbContext db, ICurrentUser currentUser, TwoFactorService twoFactor, IEmailOutbox outbox, IFileStorage storage, PrivacyProcessor processor)
{
    public const string SettingKey = "privacy";
    public const string ApiModule = "privacy";
    public const int ExportsPerWindow = 1;
    public static readonly TimeSpan ExportWindow = TimeSpan.FromHours(24);
    /// <summary>Own code purpose for "confirm deletion" emails (AuthCodePurpose is owned by auth; ints 1–3 are taken there).</summary>
    public const AuthCodePurpose DeletionCodePurpose = (AuthCodePurpose)10;
    public const int DeletionCodeMinutes = 15;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");
    private ulong TenantId => currentUser.TenantId ?? throw new UnauthorizedAccessException("Sign in again.");

    // ── Settings ────────────────────────────────────────────────────────────

    public static async Task<PrivacySettings> LoadSettingsAsync(IAppDbContext db, ulong tenantId)
    {
        var row = await db.TenantSettings.AcrossTenants().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        return row?.Value is null ? new PrivacySettings() : row.Value.Deserialize<PrivacySettings>(Json) ?? new PrivacySettings();
    }

    public Task<PrivacySettings> GetSettingsAsync() => LoadSettingsAsync(db, TenantId);

    public async Task<PrivacySettings> SaveSettingsAsync(PrivacySettings s)
    {
        if (s.GraceDays is < 7 or > 30) throw new ArgumentException("Grace period: choose between 7 and 30 days.");
        s.SocialContentOnDeletion = (s.SocialContentOnDeletion ?? "").Trim().ToLowerInvariant();
        if (!SocialContentModes.All.Contains(s.SocialContentOnDeletion))
            throw new ArgumentException("Social content: choose \"anonymise\" or \"delete\".");
        s.PrivacyPolicyUrl = CleanUrl(s.PrivacyPolicyUrl, "Privacy policy link");
        s.TermsUrl = CleanUrl(s.TermsUrl, "Terms link");

        var tenantId = TenantId;
        var row = await db.TenantSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(s, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else row.Value = value;
        Audit(tenantId, "privacy.settings_updated", "TenantSetting", null, new { s.GraceDays, s.SocialContentOnDeletion, s.CancelMembershipOnDeletion });
        await db.SaveChangesAsync();
        return s;
    }

    private static string? CleanUrl(string? url, string label)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        url = url.Trim();
        if (url.Length > 500 || !Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            throw new ArgumentException($"{label}: enter a full https:// address.");
        return url;
    }

    // ── Member: overview ────────────────────────────────────────────────────

    public async Task<PrivacyOverviewResponse> GetOverviewAsync()
    {
        var me = await LoadMeAsync();
        var settings = await LoadSettingsAsync(db, me.TenantId);
        var open = await OpenRequestAsync(me.TenantId, me.Id);
        var exports = await db.DataExportRequests.AsNoTracking().Where(e => e.TenantId == me.TenantId && e.UserId == me.Id)
            .OrderByDescending(e => e.RequestedAt).Take(5).ToListAsync();
        var now = DateTime.UtcNow;
        return new PrivacyOverviewResponse
        {
            Links = Links(settings),
            PendingDeletion = open is null ? null : Map(open),
            DeletionCheck = await processor.CheckAsync(me.TenantId, me.Id),
            Reauth = new ReauthRequirements
            {
                Method = string.IsNullOrEmpty(me.PasswordHash) ? "email_code" : "password",
                TwoFactor = await twoFactor.IsEnabledAsync(me.Id),
                HasEmail = !string.IsNullOrWhiteSpace(me.Email),
            },
            Exports = exports.Select(e => Map(e, now)).ToList(),
            NextExportAt = NextExportAt(exports, now),
        };
    }

    /// <summary>Just the open deletion request (for the app-wide banner); null when none.</summary>
    public async Task<DeletionRequestResponse?> GetMyDeletionAsync()
    {
        var open = await OpenRequestAsync(TenantId, Me);
        return open is null ? null : Map(open);
    }

    private static PrivacyLinksResponse Links(PrivacySettings s) => new()
    {
        PrivacyPolicyUrl = s.PrivacyPolicyUrl, TermsUrl = s.TermsUrl, GraceDays = s.GraceDays,
        CancelMembershipOnDeletion = s.CancelMembershipOnDeletion, SocialContentOnDeletion = s.SocialContentOnDeletion,
    };

    // ── Member: delete my account ───────────────────────────────────────────

    /// <summary>For accounts without a password: emails a 6-digit code that confirms the deletion.</summary>
    public async Task SendDeletionCodeAsync()
    {
        var me = await LoadMeAsync();
        if (string.IsNullOrWhiteSpace(me.Email)) throw RuleException.Unprocessable("Your account has no email address. Please ask the front desk to delete your account.");
        await db.AuthCodes.Where(c => c.UserId == me.Id && c.Purpose == DeletionCodePurpose).ExecuteDeleteAsync();
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        db.AuthCodes.Add(new AuthCode
        {
            UserId = me.Id, Purpose = DeletionCodePurpose, CodeHash = Sha256($"{me.Id}:{code}"),
            ExpiresAt = DateTime.UtcNow.AddMinutes(DeletionCodeMinutes),
        });
        outbox.Enqueue(me.TenantId, me.Id, me.Email, "Your code to delete your account",
            EmailTemplates.Code("Confirm account deletion", "Someone (hopefully you) asked to delete your account. Enter this code in the app to confirm:", code, DeletionCodeMinutes));
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Re-auth, blockers, then a Pending request with the gym's grace period. All sessions are
    /// revoked straight away; signing in again during the grace period shows "Keep my account".
    /// </summary>
    public async Task<DeletionRequestResponse> RequestMyDeletionAsync(RequestDeletionBody body, PrivacyRequestMeta meta)
    {
        if (!body.Confirm) throw new ArgumentException("Please tick the box to confirm you understand what will be deleted.");
        var me = await LoadMeAsync(tracked: true);
        var existing = await OpenRequestAsync(me.TenantId, me.Id);
        if (existing is { Status: DeletionStatuses.Pending }) return Map(existing);

        await VerifyIdentityAsync(me, body);

        var now = DateTime.UtcNow;
        var check = await processor.CheckAsync(me.TenantId, me.Id);
        if (!check.CanDelete)
        {
            // Recorded (once a day) so staff can see who wants to leave but can't yet.
            var since = now.AddDays(-1);
            var recent = await db.AccountDeletionRequests.FirstOrDefaultAsync(r => r.TenantId == me.TenantId && r.UserId == me.Id
                && r.Status == DeletionStatuses.Blocked && r.RequestedAt >= since);
            var reason = Truncate(string.Join(" ", check.Blockers.Select(b => b.Message)), 500);
            if (recent is null)
                db.AccountDeletionRequests.Add(new AccountDeletionRequest
                {
                    TenantId = me.TenantId, UserId = me.Id, Status = DeletionStatuses.Blocked, Source = "self", RequestedByUserId = me.Id,
                    RequestedAt = now, ScheduledFor = now, BlockedReason = reason,
                });
            else recent.BlockedReason = reason;
            await db.SaveChangesAsync();
            throw new RuleException("You can't delete your account yet. " + string.Join(" ", check.Blockers.Select(b => b.Message)), RuleException.UnprocessableStatus)
            { Code = "DELETION_BLOCKED", Payload = check };
        }

        var settings = await LoadSettingsAsync(db, me.TenantId);
        var request = await CreatePendingAsync(me, existing, "self", me.Id, now.AddDays(settings.GraceDays), null, now);
        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, me.Id);
        return Map(request);
    }

    private async Task<AccountDeletionRequest> CreatePendingAsync(User user, AccountDeletionRequest? blocked, string source, ulong actor, DateTime scheduledFor, string? reason, DateTime now)
    {
        var request = blocked ?? new AccountDeletionRequest { TenantId = user.TenantId, UserId = user.Id };
        request.Status = DeletionStatuses.Pending;
        request.Source = source;
        request.RequestedByUserId = actor;
        request.RequestedAt = now;
        request.ScheduledFor = scheduledFor;
        request.BlockedReason = null;
        request.Reason = Truncate(reason, 500);
        if (blocked is null) db.AccountDeletionRequests.Add(request);
        await db.SaveChangesAsync(); // the id goes in the audit entry

        Audit(user.TenantId, "privacy.deletion_requested", "AccountDeletionRequest", request.Id,
            new { userId = user.Id, source, scheduledFor });
        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            var gym = await db.Tenants.AcrossTenants().Where(t => t.Id == user.TenantId).Select(t => t.Name).FirstOrDefaultAsync() ?? "your gym";
            outbox.Enqueue(user.TenantId, user.Id, user.Email, $"Your {gym} account will be deleted on {scheduledFor:dd MMM yyyy}",
                EmailTemplates.Wrap("We've received your request to delete your account", $"""
                    <p>Your {System.Net.WebUtility.HtmlEncode(gym)} account and personal details will be deleted on <b>{scheduledFor:dd MMM yyyy}</b>.</p>
                    <p>Changed your mind? Sign in to the app before then and tap <b>Keep my account</b>.</p>
                    <p>For your security you've been signed out on all devices. If you didn't ask for this, sign in, tap Keep my account and change your password.</p>
                    """), $"privacy-deletion-requested:{request.Id}:{now:yyyyMMddHHmm}");
        }
        return request;
    }

    /// <summary>"Keep my account": cancels the pending request.</summary>
    public async Task<DeletionRequestResponse?> CancelMyDeletionAsync()
    {
        var request = await db.AccountDeletionRequests.FirstOrDefaultAsync(r => r.TenantId == TenantId && r.UserId == Me
            && (r.Status == DeletionStatuses.Pending || r.Status == DeletionStatuses.Blocked));
        if (request is null) return null;
        Cancel(request, Me);
        await db.SaveChangesAsync();
        return Map(request);
    }

    private void Cancel(AccountDeletionRequest request, ulong actor)
    {
        request.Status = DeletionStatuses.Cancelled;
        request.CancelledAt = DateTime.UtcNow;
        request.CancelledByUserId = actor;
        Audit(request.TenantId, "privacy.deletion_cancelled", "AccountDeletionRequest", request.Id, new { userId = request.UserId });
    }

    /// <summary>
    /// Password (or the emailed code when the account has none), plus a two-step code when 2FA is on.
    /// Uses the same <see cref="PasswordHasher"/> as sign-in.
    /// </summary>
    private async Task VerifyIdentityAsync(User me, RequestDeletionBody body)
    {
        if (!string.IsNullOrEmpty(me.PasswordHash))
        {
            if (string.IsNullOrEmpty(body.Password)) throw new ArgumentException("Password: enter your password to confirm.");
            if (!PasswordHasher.Verify(body.Password, me.PasswordHash, out _))
                throw new RuleException("That password isn't right. Please try again.", RuleException.UnprocessableStatus) { Code = "REAUTH_FAILED" };
        }
        else if (!await ConsumeDeletionCodeAsync(me.Id, body.Code))
        {
            throw new RuleException("That code isn't right or has expired. Ask for a new one.", RuleException.UnprocessableStatus) { Code = "REAUTH_FAILED" };
        }

        if (await twoFactor.IsEnabledAsync(me.Id))
        {
            if (string.IsNullOrWhiteSpace(body.TwoFactorCode))
                throw new RuleException("Enter the code from your authenticator app (or a recovery code).", RuleException.UnprocessableStatus) { Code = "TWO_FACTOR_REQUIRED" };
            if (!await twoFactor.VerifyAnyAsync(me.Id, body.TwoFactorCode))
                throw new RuleException("That two-step code isn't right. Please try again.", RuleException.UnprocessableStatus) { Code = "REAUTH_FAILED" };
        }
    }

    private async Task<bool> ConsumeDeletionCodeAsync(ulong userId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        var row = await db.AuthCodes.Where(c => c.UserId == userId && c.Purpose == DeletionCodePurpose && c.UsedAt == null)
            .OrderByDescending(c => c.CreatedAt).FirstOrDefaultAsync();
        if (row is null || row.ExpiresAt < DateTime.UtcNow || row.Attempts >= AuthCode.MaxAttempts) return false;
        var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(row.CodeHash), Encoding.UTF8.GetBytes(Sha256($"{userId}:{code.Trim()}")));
        if (ok) row.UsedAt = DateTime.UtcNow; else row.Attempts++;
        await db.SaveChangesAsync();
        return ok;
    }

    // ── Member: download my data ────────────────────────────────────────────

    public async Task<DataExportResponse> RequestMyExportAsync()
    {
        var me = await LoadMeAsync();
        var now = DateTime.UtcNow;
        var recent = await db.DataExportRequests.AsNoTracking()
            .Where(e => e.TenantId == me.TenantId && e.UserId == me.Id && e.Status != ExportStatuses.Failed && e.RequestedAt > now - ExportWindow)
            .ToListAsync();
        if (recent.Count >= ExportsPerWindow)
        {
            var next = NextExportAt(recent, now)!.Value;
            throw new RuleException($"You can download your data once a day. You can ask again after {next:dd MMM HH:mm} UTC.", 429)
            { Code = "EXPORT_RATE_LIMITED", Payload = new { nextExportAt = next } };
        }
        var export = new DataExportRequest { TenantId = me.TenantId, UserId = me.Id, RequestedByUserId = me.Id, RequestedAt = now, Status = ExportStatuses.Queued };
        db.DataExportRequests.Add(export);
        await db.SaveChangesAsync();
        Audit(me.TenantId, "privacy.export_requested", "DataExportRequest", export.Id, new { userId = me.Id });
        await db.SaveChangesAsync();
        return Map(export, now);
    }

    public async Task<List<DataExportResponse>> GetMyExportsAsync()
    {
        var now = DateTime.UtcNow;
        var rows = await db.DataExportRequests.AsNoTracking().Where(e => e.TenantId == TenantId && e.UserId == Me)
            .OrderByDescending(e => e.RequestedAt).Take(20).ToListAsync();
        return rows.Select(e => Map(e, now)).ToList();
    }

    /// <summary>A short-lived signed link to the member's own ready export; 410 once its 7 days are up.</summary>
    public async Task<ExportLinkResponse> GetMyExportLinkAsync(ulong exportId)
    {
        var e = await db.DataExportRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == exportId && x.TenantId == TenantId && x.UserId == Me)
                ?? throw new KeyNotFoundException("Export not found.");
        var now = DateTime.UtcNow;
        if (e.Status == ExportStatuses.Expired || (e.Status == ExportStatuses.Ready && e.ExpiresAt <= now))
            throw new RuleException("This download has expired. Request a new one.", 410) { Code = "EXPORT_EXPIRED" };
        if (e.Status != ExportStatuses.Ready || e.FileUrl is null)
            throw RuleException.Conflict("Your download isn't ready yet. We'll let you know when it is.");
        return new ExportLinkResponse { Url = await storage.GetSignedUrlAsync(e.FileUrl), ExpiresAt = e.ExpiresAt!.Value };
    }

    private static DateTime? NextExportAt(IEnumerable<DataExportRequest> rows, DateTime now)
    {
        var last = rows.Where(e => e.Status != ExportStatuses.Failed && e.RequestedAt > now - ExportWindow)
            .Select(e => (DateTime?)e.RequestedAt).Max();
        return last is null ? null : last.Value + ExportWindow;
    }

    // ── Admin ───────────────────────────────────────────────────────────────

    public async Task<AdminPrivacyRequestsResponse> GetRequestsAsync(string? status)
    {
        var tenantId = TenantId;
        var q = db.AccountDeletionRequests.AsNoTracking().Where(r => r.TenantId == tenantId);
        if (!string.IsNullOrWhiteSpace(status))
        {
            status = status.Trim().ToLowerInvariant();
            if (!DeletionStatuses.All.Contains(status)) throw new ArgumentException($"Status: one of {string.Join(", ", DeletionStatuses.All)}.");
            q = q.Where(r => r.Status == status);
        }
        var deletions = await q.OrderByDescending(r => r.RequestedAt).Take(200).ToListAsync();
        var exports = await db.DataExportRequests.AsNoTracking().Where(e => e.TenantId == tenantId)
            .OrderByDescending(e => e.RequestedAt).Take(100).ToListAsync();
        var ids = deletions.Select(d => d.UserId).Concat(exports.Select(e => e.UserId)).Distinct().ToList();
        var names = await db.Users.AcrossTenants().Where(u => u.TenantId == tenantId && ids.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName }).ToDictionaryAsync(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());
        var now = DateTime.UtcNow;
        return new AdminPrivacyRequestsResponse
        {
            Deletions = deletions.Select(d => new AdminDeletionRow
            {
                Id = d.Id, UserId = d.UserId, MemberName = names.GetValueOrDefault(d.UserId, $"Member #{d.UserId}"), Status = d.Status, Source = d.Source,
                RequestedAt = d.RequestedAt, ScheduledFor = d.ScheduledFor, CancelledAt = d.CancelledAt, CompletedAt = d.CompletedAt,
                BlockedReason = d.BlockedReason, Reason = d.Reason,
                Tables = d.Summary?.RootElement.TryGetProperty("tables", out var t) == true ? t.Deserialize<Dictionary<string, int>>() : null,
            }).ToList(),
            Exports = exports.Select(e => new AdminExportRow
            {
                Id = e.Id, UserId = e.UserId, MemberName = names.GetValueOrDefault(e.UserId, $"Member #{e.UserId}"),
                Status = e.Status == ExportStatuses.Ready && e.ExpiresAt <= now ? ExportStatuses.Expired : e.Status,
                RequestedAt = e.RequestedAt, ReadyAt = e.ReadyAt, ExpiresAt = e.ExpiresAt, Error = e.Error,
            }).ToList(),
        };
    }

    /// <summary>Admin "Process now": anonymises immediately (still refused while money is owed).</summary>
    public async Task<AdminDeletionRow> ProcessNowAsync(ulong requestId)
    {
        var request = await db.AccountDeletionRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.TenantId == TenantId)
                      ?? throw new KeyNotFoundException("Request not found.");
        if (request.UserId == Me) throw new ArgumentException("You can't process your own deletion.");
        var completed = await processor.ExecuteAsync(request, Me, DateTime.UtcNow);
        if (!completed)
            throw new RuleException("This account can't be deleted yet: " + request.BlockedReason, RuleException.UnprocessableStatus) { Code = "DELETION_BLOCKED" };
        return (await GetRequestsAsync(null)).Deletions.First(d => d.Id == requestId);
    }

    public async Task CancelRequestAsync(ulong requestId)
    {
        var request = await db.AccountDeletionRequests.FirstOrDefaultAsync(r => r.Id == requestId && r.TenantId == TenantId)
                      ?? throw new KeyNotFoundException("Request not found.");
        if (request.Status is not (DeletionStatuses.Pending or DeletionStatuses.Blocked)) throw RuleException.Conflict("This request is no longer open.");
        Cancel(request, Me);
        await db.SaveChangesAsync();
    }

    /// <summary>Staff delete a member's account from member detail (e.g. asked at the desk). Members only; audit-logged.</summary>
    public async Task<DeletionRequestResponse> RequestForMemberAsync(ulong memberId, StaffDeletionBody body)
    {
        if (string.IsNullOrWhiteSpace(body.Reason) || body.Reason.Trim().Length < 3)
            throw new ArgumentException("Reason: say why (e.g. \"Member asked at the desk on 3 Nov\").");
        var tenantId = TenantId;
        if (memberId == Me) throw new ArgumentException("Use Privacy & data in your own profile to delete your own account.");
        var member = await db.Users.AcrossTenants().FirstOrDefaultAsync(u => u.Id == memberId && u.TenantId == tenantId && u.DeletedAt == null)
                     ?? throw new KeyNotFoundException("Member not found.");
        var slug = await db.Roles.AcrossTenants().Where(r => r.Id == member.RoleId).Select(r => r.Slug).FirstOrDefaultAsync();
        if (!string.Equals(slug, RoleNames.Client, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Only member accounts can be deleted here. Deactivate staff accounts from Access instead.");

        var check = await processor.CheckAsync(tenantId, memberId);
        if (!check.CanDelete)
            throw new RuleException("This member can't be deleted yet. " + string.Join(" ", check.Blockers.Select(b => b.Message)), RuleException.UnprocessableStatus)
            { Code = "DELETION_BLOCKED", Payload = check };

        var now = DateTime.UtcNow;
        var open = await db.AccountDeletionRequests.FirstOrDefaultAsync(r => r.TenantId == tenantId && r.UserId == memberId
            && (r.Status == DeletionStatuses.Pending || r.Status == DeletionStatuses.Blocked));
        var settings = await LoadSettingsAsync(db, tenantId);
        var request = await CreatePendingAsync(member, open, "staff", Me, body.ProcessNow ? now : now.AddDays(settings.GraceDays), body.Reason.Trim(), now);
        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, memberId);
        if (body.ProcessNow) await processor.ExecuteAsync(request, Me, now);
        return Map(request);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private async Task<User> LoadMeAsync(bool tracked = false)
    {
        var q = db.Users.AcrossTenants().Where(u => u.Id == Me && u.TenantId == TenantId && u.DeletedAt == null);
        return await (tracked ? q : q.AsNoTracking()).FirstOrDefaultAsync() ?? throw new KeyNotFoundException("Account not found.");
    }

    private Task<AccountDeletionRequest?> OpenRequestAsync(ulong tenantId, ulong userId) =>
        db.AccountDeletionRequests.Where(r => r.TenantId == tenantId && r.UserId == userId
                && (r.Status == DeletionStatuses.Pending || r.Status == DeletionStatuses.Blocked))
            .OrderByDescending(r => r.RequestedAt).FirstOrDefaultAsync();

    private void Audit(ulong tenantId, string action, string entityType, ulong? entityId, object values) =>
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = tenantId, UserId = currentUser.UserId, Action = action, EntityType = entityType, EntityId = entityId,
            NewValues = JsonSerializer.SerializeToDocument(values, Json), CreatedAt = DateTime.UtcNow,
        });

    private static DeletionRequestResponse Map(AccountDeletionRequest r) => new()
    {
        Id = r.Id, Status = r.Status, Source = r.Source, RequestedAt = r.RequestedAt, ScheduledFor = r.ScheduledFor,
        CancelledAt = r.CancelledAt, CompletedAt = r.CompletedAt, BlockedReason = r.BlockedReason,
    };

    private static DataExportResponse Map(DataExportRequest e, DateTime now) => new()
    {
        Id = e.Id, RequestedAt = e.RequestedAt, ReadyAt = e.ReadyAt, ExpiresAt = e.ExpiresAt, SizeBytes = e.SizeBytes,
        Status = e.Status == ExportStatuses.Ready && e.ExpiresAt <= now ? ExportStatuses.Expired
            : e.Status == ExportStatuses.Queued ? ExportStatuses.Preparing : e.Status,
    };

    private static string? Truncate(string? s, int max) => s is null ? null : s.Length <= max ? s : s[..max];
    private static string Sha256(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}
