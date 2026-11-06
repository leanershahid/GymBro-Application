using System.IO.Compression;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Privacy;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace GymManagmentApplication.Application.Privacy;

/// <summary>
/// The work behind privacy requests, shared by the API (admin "process now") and the background
/// job (<c>Infrastructure/Jobs/PrivacyJobs</c>): the deletion pre-checks, the anonymisation and
/// building data exports. Every query names its tenant and user explicitly (it runs without a
/// signed-in user, where the tenant filter is off), so one gym's or member's data never leaks
/// into another's.
/// </summary>
public class PrivacyProcessor(IAppDbContext db, IFileStorage storage, IEmailOutbox outbox, Notifier notifier, ILogger<PrivacyProcessor> logger)
{
    public const int ExportValidDays = 7;
    public const int ExportMaxAttempts = 3;
    public const string DeletedFirstName = "Deleted";
    public const string DeletedLastName = "member";
    public const string DeletedName = DeletedFirstName + " " + DeletedLastName;
    public static string DeletedEmail(ulong userId) => $"deleted+{userId}@invalid";

    private static readonly ShopOrderStatus[] OrderInProgress =
        [ShopOrderStatus.Pending, ShopOrderStatus.Confirmed, ShopOrderStatus.Processing, ShopOrderStatus.Shipped, ShopOrderStatus.OutForDelivery];
    private static readonly MembershipStatus[] LiveMembership =
        [MembershipStatus.Active, MembershipStatus.Trial, MembershipStatus.Paused, MembershipStatus.Pending];

    // ── Pre-checks ───────────────────────────────────────────────────────────

    /// <summary>Blockers (money owed, an order on its way) and warnings (memberships, social posts) for deleting this account.</summary>
    public async Task<DeletionCheckResponse> CheckAsync(ulong tenantId, ulong userId)
    {
        var settings = await PrivacyService.LoadSettingsAsync(db, tenantId);
        var check = new DeletionCheckResponse();

        var owed = await db.Invoices.AcrossTenants().AsNoTracking()
            .Where(i => i.TenantId == tenantId && i.UserId == userId
                        && (i.Status == InvoiceStatus.Sent || i.Status == InvoiceStatus.Overdue) && i.Total > i.AmountPaid)
            .Select(i => new { i.Total, i.AmountPaid, i.Currency }).ToListAsync();
        if (owed.Count > 0)
        {
            var currency = owed[0].Currency;
            var amount = owed.Sum(i => i.Total - i.AmountPaid);
            check.Blockers.Add(new DeletionIssue
            {
                Code = "open_invoices",
                Message = $"You have {owed.Count} unpaid invoice{(owed.Count == 1 ? "" : "s")} ({currency} {amount:0.##} owed).",
                Action = "Pay what's owed in Membership → Invoices, or speak to the front desk. You can delete your account once it's settled.",
                Route = "billing",
            });
        }

        var orders = await db.ShopOrders.AcrossTenants().AsNoTracking()
            .CountAsync(o => o.TenantId == tenantId && o.UserId == userId && OrderInProgress.Contains(o.Status));
        if (orders > 0)
            check.Blockers.Add(new DeletionIssue
            {
                Code = "order_in_progress",
                Message = $"You have {orders} shop order{(orders == 1 ? "" : "s")} still being prepared or delivered.",
                Action = "Wait until it's delivered, or cancel it in Shop → Orders. Then try again.",
                Route = "shop/orders",
            });

        var memberships = await db.GymMemberships.AcrossTenants().AsNoTracking()
            .CountAsync(m => m.TenantId == tenantId && m.UserId == userId && LiveMembership.Contains(m.Status));
        if (memberships > 0)
            check.Warnings.Add(settings.CancelMembershipOnDeletion
                ? new DeletionIssue
                {
                    Code = "active_membership",
                    Message = "Your membership will be cancelled when your account is deleted. Any refund is up to the gym's terms — it isn't made automatically.",
                    Action = "Ask the front desk if you think you're owed a refund.",
                    Route = "billing",
                }
                : new DeletionIssue
                {
                    Code = "active_membership",
                    Message = "Deleting your account stops automatic renewal, but it doesn't end your current membership contract or give a refund.",
                    Action = "If you still owe for a minimum term, the gym may contact you. Ask the front desk to cancel it properly.",
                    Route = "billing",
                });

        var posts = await db.SocialPosts.AcrossTenants().AsNoTracking()
            .CountAsync(p => p.TenantId == tenantId && p.UserId == userId && !p.IsDeleted);
        if (posts > 0)
            check.Warnings.Add(new DeletionIssue
            {
                Code = "social_content",
                Message = settings.SocialContentOnDeletion == SocialContentModes.Delete
                    ? $"Your {posts} social post{(posts == 1 ? "" : "s")} and comments will be deleted."
                    : $"Your {posts} social post{(posts == 1 ? "" : "s")} and comments will stay, shown as \"{DeletedName}\".",
                Action = settings.SocialContentOnDeletion == SocialContentModes.Delete ? null : "Delete any posts you don't want kept before you go.",
                Route = "social",
            });
        return check;
    }

    // ── Deletion ─────────────────────────────────────────────────────────────

    /// <summary>Anonymises every pending request of the gym whose grace period has ended. Returns how many completed.</summary>
    public async Task<int> RunDueDeletionsAsync(ulong tenantId, DateTime now, CancellationToken ct = default)
    {
        var due = await db.AccountDeletionRequests.AcrossTenants()
            .Where(r => r.TenantId == tenantId && r.Status == DeletionStatuses.Pending && r.ScheduledFor <= now)
            .OrderBy(r => r.ScheduledFor).Take(50).ToListAsync(ct);
        var done = 0;
        foreach (var r in due)
        {
            try { if (await ExecuteAsync(r, null, now)) done++; }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Anonymising deletion request {Id} failed.", r.Id);
                db.ChangeTracker.Clear();
            }
        }
        await RedactSentEmailsAsync(tenantId, now, ct);
        return done;
    }

    /// <summary>
    /// Runs one deletion: re-checks the blockers (a new invoice may have appeared during the grace
    /// period → the request becomes Blocked for staff to look at), then anonymises in one
    /// transaction, deletes stored files and emails the confirmation. True when completed.
    /// </summary>
    public async Task<bool> ExecuteAsync(AccountDeletionRequest request, ulong? actorUserId, DateTime now)
    {
        if (request.Status is not (DeletionStatuses.Pending or DeletionStatuses.Blocked))
            throw RuleException.Conflict("This request is no longer open.");
        var tenantId = request.TenantId;
        var userId = request.UserId;

        var check = await CheckAsync(tenantId, userId);
        if (!check.CanDelete)
        {
            request.Status = DeletionStatuses.Blocked;
            request.BlockedReason = string.Join(" ", check.Blockers.Select(b => b.Message));
            if (request.BlockedReason.Length > 500) request.BlockedReason = request.BlockedReason[..500];
            await db.SaveChangesAsync();
            return false;
        }

        var user = await db.Users.AcrossTenants().FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId)
                   ?? throw new KeyNotFoundException("Member not found.");
        var settings = await PrivacyService.LoadSettingsAsync(db, tenantId);
        var realEmail = user.Email;
        var gymName = await db.Tenants.AcrossTenants().Where(t => t.Id == tenantId).Select(t => t.Name).FirstOrDefaultAsync() ?? "your gym";
        var files = new List<string>();
        var tables = new Dictionary<string, int>();

        await db.InTransactionAsync(async () =>
        {
            tables = await AnonymiseAsync(user, settings, files, now);

            request.Status = DeletionStatuses.Completed;
            request.CompletedAt = now;
            request.ProcessedByUserId = actorUserId;
            request.BlockedReason = null;
            request.Summary = JsonSerializer.SerializeToDocument(new { tables, files = files.Count });
            db.AuditLogs.Add(new AuditLog
            {
                TenantId = tenantId, UserId = actorUserId, Action = "privacy.account_anonymised", EntityType = "User", EntityId = userId,
                NewValues = JsonSerializer.SerializeToDocument(new { requestId = request.Id, source = request.Source, tables = tables.Keys, counts = tables }),
                CreatedAt = now,
            });
            if (!string.IsNullOrWhiteSpace(realEmail) && !realEmail.EndsWith("@invalid", StringComparison.OrdinalIgnoreCase))
                outbox.Enqueue(tenantId, userId, realEmail, $"Your {gymName} account has been deleted",
                    EmailTemplates.Wrap("Your account has been deleted", $"""
                        <p>As you asked, your {WebUtility.HtmlEncode(gymName)} account and personal details have now been deleted.</p>
                        <p>We keep invoices, payments and shop orders with your name removed, because tax law requires it. Signed waivers are kept as a dated legal record without your name.</p>
                        <p>This is the last email we'll send to this address.</p>
                        """), $"privacy-deletion-completed:{request.Id}");
            await db.SaveChangesAsync();
        });

        await AuthSessions.RevokeAllAsync(db, userId);
        foreach (var url in files.Distinct()) await storage.DeleteAsync(url); // best effort, after commit
        logger.LogInformation("Account {User} of tenant {Tenant} anonymised ({Tables} tables).", userId, tenantId, tables.Count);
        return true;
    }

    /// <summary>
    /// Removes / redacts the member's personal data; collects stored file URLs to delete into
    /// <paramref name="files"/>. Append-only legal records (waiver signatures, consents) are
    /// redacted with set-based updates, which bypass the append-only guard on purpose: the row,
    /// version and date stay, the personal details go.
    /// </summary>
    private async Task<Dictionary<string, int>> AnonymiseAsync(Domain.Entities.Identity.User user, PrivacySettings settings, List<string> files, DateTime now)
    {
        var t = user.TenantId;
        var u = user.Id;
        var counts = new Dictionary<string, int>();
        void Count(string table, int n) { if (n > 0) counts[table] = counts.GetValueOrDefault(table) + n; }

        // Incidents are kept (legal record); the member's name on them becomes the anonymised reference.
        // Runs first, while the user row still has the name to replace.
        foreach (var (table, n) in await Facilities.FacilitiesPrivacy.AnonymiseAsync(db, t, u, $"{user.FirstName} {user.LastName}")) Count(table, n);

        // User row: kept (invoices, payments and orders point at it), personal fields cleared.
        if (!string.IsNullOrEmpty(user.AvatarUrl)) files.Add(user.AvatarUrl);
        user.FirstName = DeletedFirstName;
        user.LastName = DeletedLastName;
        user.Email = DeletedEmail(u);
        user.Phone = null;
        user.Dob = null;
        user.Gender = null;
        user.AvatarUrl = null;
        user.PasswordHash = null;
        user.FaceEncoding = null;
        user.BiometricHash = null;
        user.Notes = null;
        user.CustomFields = null;
        user.NotificationPrefs = null;
        user.EmailVerifiedAt = null;
        user.PhoneVerifiedAt = null;
        user.Status = UserStatus.Inactive;
        user.DeletedAt = now;
        Count("Users", 1);

        // Health profile: the row stays (1:1 with the user), its health and contact fields go.
        var profiles = await db.ClientProfiles.AcrossTenants().Where(p => p.UserId == u).ToListAsync();
        foreach (var p in profiles)
        {
            p.HeightCm = p.WeightKg = p.BodyFatPct = p.MuscleMassKg = null;
            p.HealthConditions = p.Allergies = p.FitnessGoals = p.EmergencyContact = null;
        }
        Count("ClientProfiles", profiles.Count);

        Count("MemberEmergencyContacts", await db.MemberEmergencyContacts.AcrossTenants().Where(c => c.TenantId == t && c.UserId == u).ExecuteDeleteAsync());
        Count("HealthScreenings", await db.HealthScreenings.AcrossTenants().Where(h => h.TenantId == t && h.UserId == u).ExecuteDeleteAsync());
        Count("HealthMetrics", await db.HealthMetrics.AcrossTenants().Where(h => h.ClientId == u && (h.TenantId == t || h.TenantId == null)).ExecuteDeleteAsync());

        var journals = await db.TransformationJournals.AcrossTenants().Where(j => j.ClientId == u && (j.TenantId == t || j.TenantId == null))
            .Select(j => j.Photos).ToListAsync();
        foreach (var photos in journals) files.AddRange(UrlsIn(photos));
        Count("TransformationJournals", await db.TransformationJournals.AcrossTenants().Where(j => j.ClientId == u && (j.TenantId == t || j.TenantId == null)).ExecuteDeleteAsync());

        // Signed waivers: legal record kept (version, date, hash), signer details redacted.
        Count("WaiverSignatures", await db.WaiverSignatures.AcrossTenants().Where(s => s.TenantId == t && s.UserId == u)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.SignedName, DeletedName).SetProperty(x => x.Ip, (string?)null).SetProperty(x => x.UserAgent, (string?)null)));
        // Consent history: kept as proof of what was agreed when; the IP address goes.
        Count("ConsentRecords", await db.ConsentRecords.AcrossTenants().Where(c => c.TenantId == t && c.UserId == u && c.Ip != null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Ip, (string?)null)));

        // Devices, sign-in and notification state.
        Count("PushDevices", await db.PushDevices.AcrossTenants().Where(d => d.UserId == u).ExecuteDeleteAsync());
        Count("NotificationPreferences", await db.NotificationPreferences.AcrossTenants().Where(d => d.UserId == u).ExecuteDeleteAsync());
        Count("Notifications", await db.Notifications.AcrossTenants().Where(n => n.TenantId == t && n.UserId == u).ExecuteDeleteAsync());
        Count("UserSessions", await db.UserSessions.Where(s => s.UserId == u).ExecuteDeleteAsync());
        Count("AuthCodes", await db.AuthCodes.Where(c => c.UserId == u).ExecuteDeleteAsync());
        Count("TrustedDevices", await db.TrustedDevices.Where(d => d.UserId == u).ExecuteDeleteAsync());
        Count("TwoFactorChallenges", await db.TwoFactorChallenges.Where(d => d.UserId == u).ExecuteDeleteAsync());
        Count("TwoFactorRecoveryCodes", await db.TwoFactorRecoveryCodes.Where(d => d.UserId == u).ExecuteDeleteAsync());
        Count("UserTwoFactors", await db.UserTwoFactors.Where(d => d.UserId == u).ExecuteDeleteAsync());

        // Social content: author anonymised (the user row above) or removed, per gym setting.
        if (settings.SocialContentOnDeletion == SocialContentModes.Delete)
        {
            var postIds = await db.SocialPosts.AcrossTenants().Where(p => p.TenantId == t && p.UserId == u).Select(p => p.Id).ToListAsync();
            files.AddRange(await db.SocialPostImages.AcrossTenants().Where(i => postIds.Contains(i.PostId)).Select(i => i.ImageUrl).ToListAsync());
            Count("SocialPostImages", await db.SocialPostImages.AcrossTenants().Where(i => postIds.Contains(i.PostId)).ExecuteDeleteAsync());
            Count("SocialPosts", await db.SocialPosts.AcrossTenants().Where(p => p.TenantId == t && p.UserId == u)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDeleted, true).SetProperty(x => x.IsActive, false).SetProperty(x => x.Caption, (string?)null)));
            Count("SocialPostComments", await db.SocialPostComments.AcrossTenants().Where(c => c.UserId == u)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsDeleted, true).SetProperty(x => x.CommentText, "[deleted]")));
            Count("SocialPostLikes", await db.SocialPostLikes.AcrossTenants().Where(l => l.UserId == u).ExecuteDeleteAsync());
        }

        // Shop: addresses, cart and wishlist go; orders stay (tax records) with the delivery details redacted.
        Count("ShopAddresses", await db.ShopAddresses.AcrossTenants().Where(a => a.TenantId == t && a.UserId == u).ExecuteDeleteAsync());
        var cartIds = await db.ShopCarts.AcrossTenants().Where(c => c.TenantId == t && c.UserId == u).Select(c => c.Id).ToListAsync();
        Count("ShopCartItems", await db.ShopCartItems.AcrossTenants().Where(i => cartIds.Contains(i.CartId)).ExecuteDeleteAsync());
        Count("ShopCarts", await db.ShopCarts.AcrossTenants().Where(c => cartIds.Contains(c.Id)).ExecuteDeleteAsync());
        var wishlistIds = await db.ShopWishlists.AcrossTenants().Where(w => w.TenantId == t && w.UserId == u).Select(w => w.Id).ToListAsync();
        Count("ShopWishlistItems", await db.ShopWishlistItems.AcrossTenants().Where(i => wishlistIds.Contains(i.WishlistId)).ExecuteDeleteAsync());
        Count("ShopWishlists", await db.ShopWishlists.AcrossTenants().Where(w => wishlistIds.Contains(w.Id)).ExecuteDeleteAsync());
        var orders = await db.ShopOrders.AcrossTenants().Where(o => o.TenantId == t && o.UserId == u).ToListAsync();
        foreach (var o in orders)
        {
            // City / state / country stay: the place of supply on a tax invoice. Amounts are untouched.
            o.ShippingAddress.FullName = DeletedName;
            o.ShippingAddress.Phone = "";
            o.ShippingAddress.Line1 = "Redacted";
            o.ShippingAddress.Line2 = null;
            o.ShippingAddress.PostalCode = "";
            o.Notes = null;
        }
        Count("ShopOrders", orders.Count);

        // Memberships: auto-renew always stops (a deleted account must not keep being invoiced);
        // the contract itself is cancelled only if the gym says so (no automatic refund either way).
        {
            var live = await db.GymMemberships.AcrossTenants().Where(m => m.TenantId == t && m.UserId == u && LiveMembership.Contains(m.Status)).ToListAsync();
            foreach (var m in live)
            {
                m.AutoRenew = false;
                if (settings.CancelMembershipOnDeletion) { m.Status = MembershipStatus.Cancelled; m.CancelledAt = now; }
            }
            Count("GymMemberships", live.Count);
        }

        // Data exports: files deleted, links dead.
        var exports = await db.DataExportRequests.AcrossTenants().Where(e => e.TenantId == t && e.UserId == u).ToListAsync();
        foreach (var e in exports)
        {
            if (e.FileUrl is not null) files.Add(e.FileUrl);
            e.FileUrl = null;
            if (e.Status is ExportStatuses.Ready or ExportStatuses.Queued or ExportStatuses.Preparing) e.Status = ExportStatuses.Expired;
        }
        Count("DataExportRequests", exports.Count);

        // Help & feedback: what the member wrote is redacted; request rows stay for the gym's stats.
        foreach (var (table, n) in await Support.SupportPrivacy.AnonymiseAsync(db, t, u, files, now)) Count(table, n);

        // Messaging: the member's message bodies and photos are redacted; threads and the trainer's messages stay.
        foreach (var (table, n) in await Messaging.MessagingPrivacy.AnonymiseAsync(db, t, u, files, now)) Count(table, n);

        // Emails already sent to the member: address and body redacted (queued ones still go out).
        Count("CommunicationLogs", await RedactEmailsOfAsync(t, u));

        await db.SaveChangesAsync();
        return counts;
    }

    private Task<int> RedactEmailsOfAsync(ulong tenantId, ulong userId)
    {
        var redacted = DeletedEmail(userId);
        return db.CommunicationLogs.AcrossTenants()
            .Where(l => l.TenantId == tenantId && l.UserId == userId && l.Status != CommunicationStatus.Queued && l.Recipient != redacted
                        && l.Channel == CommunicationChannel.Email)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Recipient, redacted).SetProperty(x => x.Body, (string?)null));
    }

    /// <summary>The completion email is sent after anonymising; once delivered, its address is redacted too (next runs, for a week).</summary>
    private async Task RedactSentEmailsAsync(ulong tenantId, DateTime now, CancellationToken ct)
    {
        var since = now.AddDays(-7);
        var recent = await db.AccountDeletionRequests.AcrossTenants()
            .Where(r => r.TenantId == tenantId && r.Status == DeletionStatuses.Completed && r.CompletedAt >= since)
            .Select(r => r.UserId).ToListAsync(ct);
        foreach (var userId in recent) await RedactEmailsOfAsync(tenantId, userId);
    }

    private static IEnumerable<string> UrlsIn(JsonDocument? doc)
    {
        if (doc is null) yield break;
        var stack = new Stack<JsonElement>([doc.RootElement]);
        while (stack.Count > 0)
        {
            var e = stack.Pop();
            switch (e.ValueKind)
            {
                case JsonValueKind.String when e.GetString() is { } s && s.StartsWith("http", StringComparison.OrdinalIgnoreCase): yield return s; break;
                case JsonValueKind.Array: foreach (var x in e.EnumerateArray()) stack.Push(x); break;
                case JsonValueKind.Object: foreach (var p in e.EnumerateObject()) stack.Push(p.Value); break;
            }
        }
    }

    // ── Data exports ─────────────────────────────────────────────────────────

    /// <summary>Builds queued exports (oldest first, a few per run). Returns how many became ready.</summary>
    public async Task<int> ProcessQueuedExportsAsync(DateTime now, int max = 5, CancellationToken ct = default)
    {
        var queued = await db.DataExportRequests.AcrossTenants()
            .Where(e => e.Status == ExportStatuses.Queued || (e.Status == ExportStatuses.Preparing && e.StartedAt < now.AddMinutes(-30)))
            .OrderBy(e => e.RequestedAt).Take(max).ToListAsync(ct);
        var ready = 0;
        foreach (var e in queued)
        {
            e.Status = ExportStatuses.Preparing;
            e.StartedAt = now;
            e.Attempts++;
            await db.SaveChangesAsync(ct);
            try
            {
                var zip = await BuildExportZipAsync(e.TenantId, e.UserId, now);
                var url = await storage.SaveAsync(FileUpload.FromBytes("gymbro-data-export.zip", "application/zip", zip),
                    $"privacy-exports/{e.TenantId}", FileKind.Archive);
                e.FileUrl = url;
                e.SizeBytes = zip.LongLength;
                e.ReadyAt = now;
                e.ExpiresAt = now.AddDays(ExportValidDays);
                e.Status = ExportStatuses.Ready;
                e.Error = null;
                await NotifyReadyAsync(e);
                await db.SaveChangesAsync(ct);
                ready++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Data export {Id} failed (attempt {Attempt}).", e.Id, e.Attempts);
                e.Status = e.Attempts >= ExportMaxAttempts ? ExportStatuses.Failed : ExportStatuses.Queued;
                e.Error = "The export couldn't be prepared. " + (e.Status == ExportStatuses.Failed ? "Please request it again." : "Retrying.");
                await db.SaveChangesAsync(ct);
            }
        }
        return ready;
    }

    private async Task NotifyReadyAsync(DataExportRequest e)
    {
        var expires = e.ExpiresAt!.Value;
        notifier.Add(e.TenantId, e.UserId, "Your data download is ready",
            $"Open Profile → Privacy & data to download it. The link works until {expires:dd MMM yyyy}.", kind: "privacy", refId: e.Id);
        var email = await db.Users.AcrossTenants().Where(x => x.Id == e.UserId && x.TenantId == e.TenantId).Select(x => x.Email).FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(email))
            outbox.Enqueue(e.TenantId, e.UserId, email, "Your data download is ready", EmailTemplates.Wrap("Your data download is ready", $"""
                <p>The copy of your data you asked for is ready.</p>
                <p>Open the app, go to <b>Profile → Privacy &amp; data</b> and tap <b>Download</b>. For your security the file isn't attached here, and the download works until <b>{expires:dd MMM yyyy}</b>.</p>
                <p>If you didn't ask for this, change your password and contact your gym.</p>
                """), $"privacy-export-ready:{e.Id}");
    }

    /// <summary>Ready exports past their 7 days: file deleted, status Expired. Returns how many.</summary>
    public async Task<int> ExpireExportsAsync(DateTime now, CancellationToken ct = default)
    {
        var old = await db.DataExportRequests.AcrossTenants()
            .Where(e => e.Status == ExportStatuses.Ready && e.ExpiresAt <= now).Take(200).ToListAsync(ct);
        foreach (var e in old)
        {
            if (e.FileUrl is not null) await storage.DeleteAsync(e.FileUrl);
            e.FileUrl = null;
            e.Status = ExportStatuses.Expired;
        }
        await db.SaveChangesAsync(ct);
        return old.Count;
    }

    private static readonly JsonSerializerOptions ExportJson = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    /// <summary>Section names in the export, in order (also the summary's table of contents).</summary>
    public static readonly string[] ExportSections =
    [
        "profile", "memberships", "invoices", "payments", "attendance", "classBookings", "ptSessions",
        "workoutAssignments", "workoutPlanAssignments", "workoutLogs", "progress", "journal", "healthScreenings",
        "emergencyContact", "consents", "waiverSignatures", "shopOrders", "shopAddresses", "socialPosts", "socialComments",
        "supportRequests", "classFeedback",
        "facilityReports", "incidents",
        "messages",
    ];

    /// <summary>Everything stored about one member of one gym, as a dictionary of sections (internal secrets excluded).</summary>
    public async Task<Dictionary<string, object?>> CollectExportAsync(ulong tenantId, ulong userId)
    {
        var t = tenantId;
        var u = userId;
        var user = await db.Users.AcrossTenants().AsNoTracking().FirstOrDefaultAsync(x => x.Id == u && x.TenantId == t)
                   ?? throw new KeyNotFoundException("Member not found.");
        var profile = await db.ClientProfiles.AcrossTenants().AsNoTracking().FirstOrDefaultAsync(p => p.UserId == u && (p.TenantId == t || p.TenantId == null));
        var invoices = await db.Invoices.AcrossTenants().AsNoTracking().Where(i => i.TenantId == t && i.UserId == u).OrderBy(i => i.CreatedAt).ToListAsync();
        var invoiceIds = invoices.Select(i => i.Id).ToList();

        return new Dictionary<string, object?>
        {
            ["profile"] = new
            {
                user.Id, user.Uuid, user.FirstName, user.LastName, user.Email, user.Phone, user.Gender, user.Dob, user.AvatarUrl,
                user.PreferredLanguage, user.Status, user.CreatedAt, user.LastLoginAt, user.EmailVerifiedAt, user.PhoneVerifiedAt,
                user.BranchId, user.CustomFields, user.NotificationPrefs,
                health = profile is null ? null : new
                {
                    profile.HeightCm, profile.WeightKg, profile.BodyFatPct, profile.MuscleMassKg, profile.FitnessLevel,
                    profile.HealthConditions, profile.Allergies, profile.FitnessGoals, profile.EmergencyContact,
                },
            },
            ["memberships"] = await db.GymMemberships.AcrossTenants().AsNoTracking().Where(m => m.TenantId == t && m.UserId == u)
                .Select(m => new { m.Id, plan = m.Plan.Name, m.Status, m.StartsAt, m.EndsAt, m.PausedAt, m.CancelledAt, m.AutoRenew, m.Source, m.CreatedAt }).ToListAsync(),
            ["invoices"] = invoices.Select(i => new
            {
                i.Id, i.InvoiceNo, i.Status, i.Subtotal, i.Tax, i.Discount, i.Total, i.AmountPaid, i.Currency, i.Items, i.DueDate, i.PaidAt, i.CreatedAt,
            }).ToList(),
            ["payments"] = await db.Payments.AcrossTenants().AsNoTracking().Where(p => p.TenantId == t && invoiceIds.Contains(p.InvoiceId))
                .Select(p => new { p.Id, p.InvoiceId, p.Amount, p.Currency, p.Method, p.Status, p.Reference, p.RefundedAmount, p.CreatedAt }).ToListAsync(),
            ["attendance"] = await db.Attendances.AcrossTenants().AsNoTracking().Where(a => a.TenantId == t && a.UserId == u).ToListAsync(),
            ["classBookings"] = await db.ClassBookings.AcrossTenants().AsNoTracking().Where(b => b.TenantId == t && b.ClientId == u).ToListAsync(),
            ["ptSessions"] = await db.PtSessions.AcrossTenants().AsNoTracking().Where(p => p.TenantId == t && p.ClientId == u).ToListAsync(),
            ["workoutAssignments"] = await db.WorkoutAssignments.AcrossTenants().AsNoTracking().Where(w => w.TenantId == t && w.ClientId == u).ToListAsync(),
            ["workoutPlanAssignments"] = await db.WorkoutPlanAssignments.AcrossTenants().AsNoTracking().Where(w => w.TenantId == t && w.ClientId == u).ToListAsync(),
            ["workoutLogs"] = await db.WorkoutLogs.AcrossTenants().AsNoTracking().Where(w => w.TenantId == t && w.ClientId == u).ToListAsync(),
            ["progress"] = await db.HealthMetrics.AcrossTenants().AsNoTracking().Where(h => h.ClientId == u && (h.TenantId == t || h.TenantId == null)).ToListAsync(),
            ["journal"] = await db.TransformationJournals.AcrossTenants().AsNoTracking().Where(j => j.ClientId == u && (j.TenantId == t || j.TenantId == null)).ToListAsync(),
            ["healthScreenings"] = await db.HealthScreenings.AcrossTenants().AsNoTracking().Where(h => h.TenantId == t && h.UserId == u).ToListAsync(),
            ["emergencyContact"] = await db.MemberEmergencyContacts.AcrossTenants().AsNoTracking().Where(c => c.TenantId == t && c.UserId == u)
                .Select(c => new { c.Name, c.Relationship, c.Phone, c.UpdatedAt }).FirstOrDefaultAsync(),
            ["consents"] = await db.ConsentRecords.AcrossTenants().AsNoTracking().Where(c => c.TenantId == t && c.UserId == u)
                .OrderBy(c => c.At).Select(c => new { c.Type, c.Granted, c.Version, c.At, c.Source }).ToListAsync(),
            ["waiverSignatures"] = await db.WaiverSignatures.AcrossTenants().AsNoTracking().Where(s => s.TenantId == t && s.UserId == u)
                .Select(s => new { s.Id, waiver = s.WaiverVersion.Title, version = s.VersionNumber, s.SignedName, s.SignedAt, s.BodyHash }).ToListAsync(),
            ["shopOrders"] = await db.ShopOrders.AcrossTenants().AsNoTracking().Where(o => o.TenantId == t && o.UserId == u)
                .Select(o => new
                {
                    o.OrderNumber, o.Status, o.Subtotal, o.Discount, o.Shipping, o.Tax, o.Total, o.CouponCode, o.DeliveryMethod, o.ShippingAddress,
                    o.PlacedAt, o.DeliveredAt, o.CancelledAt,
                    items = o.Items.Select(i => new { i.ProductName, i.VariantName, i.Sku, i.UnitPrice, i.Quantity, i.LineTotal }).ToList(),
                }).ToListAsync(),
            ["shopAddresses"] = await db.ShopAddresses.AcrossTenants().AsNoTracking().Where(a => a.TenantId == t && a.UserId == u && a.DeletedAt == null)
                .Select(a => new { a.Label, a.FullName, a.Phone, a.Line1, a.Line2, a.City, a.State, a.PostalCode, a.Country }).ToListAsync(),
            ["socialPosts"] = await db.SocialPosts.AcrossTenants().AsNoTracking().Where(p => p.TenantId == t && p.UserId == u && !p.IsDeleted)
                .Select(p => new { p.Id, p.Caption, p.CreatedAt, images = p.Images.Select(i => i.ImageUrl).ToList() }).ToListAsync(),
            ["socialComments"] = await db.SocialPostComments.AcrossTenants().AsNoTracking().Where(c => c.UserId == u && !c.IsDeleted && c.Post.TenantId == t)
                .Select(c => new { c.Id, c.PostId, c.CommentText, c.CreatedAt }).ToListAsync(),
            ["supportRequests"] = await Support.SupportPrivacy.ExportRequestsAsync(db, t, u),
            ["classFeedback"] = await Support.SupportPrivacy.ExportClassFeedbackAsync(db, t, u),
            // Facilities: own problem reports; incidents only as a summary, and only where the member was injured.
            ["facilityReports"] = await Facilities.FacilitiesPrivacy.ExportReportsAsync(db, t, u),
            ["incidents"] = await Facilities.FacilitiesPrivacy.ExportIncidentSummariesAsync(db, t, u),
            // Messaging: the member's threads with both sides' messages (they are a participant).
            ["messages"] = await Messaging.MessagingPrivacy.ExportAsync(db, t, u),
        };
    }

    /// <summary>The export as a ZIP: data.json (machine-readable, everything) + summary.html (readable overview).</summary>
    public async Task<byte[]> BuildExportZipAsync(ulong tenantId, ulong userId, DateTime now)
    {
        var data = await CollectExportAsync(tenantId, userId);
        var gymName = await db.Tenants.AcrossTenants().Where(x => x.Id == tenantId).Select(x => x.Name).FirstOrDefaultAsync() ?? "Your gym";
        var envelope = new Dictionary<string, object?>
        {
            ["generatedAt"] = now, ["gym"] = gymName, ["format"] = "gymbro-data-export-v1", ["sections"] = data,
        };
        var json = JsonSerializer.SerializeToUtf8Bytes(envelope, ExportJson);

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            await using (var s = zip.CreateEntry("data.json", CompressionLevel.Optimal).Open()) await s.WriteAsync(json);
            await using (var s = zip.CreateEntry("summary.html", CompressionLevel.Optimal).Open())
                await s.WriteAsync(Encoding.UTF8.GetBytes(Summary(gymName, now, data)));
        }
        return ms.ToArray();
    }

    private static string Summary(string gymName, DateTime now, Dictionary<string, object?> data)
    {
        static int CountOf(object? v) => v switch { null => 0, System.Collections.ICollection c => c.Count, _ => 1 };
        var labels = new Dictionary<string, string>
        {
            ["profile"] = "Your profile", ["memberships"] = "Memberships", ["invoices"] = "Invoices", ["payments"] = "Payments",
            ["attendance"] = "Check-ins", ["classBookings"] = "Class bookings", ["ptSessions"] = "Personal training sessions",
            ["workoutAssignments"] = "Workouts assigned to you", ["workoutPlanAssignments"] = "Training plans", ["workoutLogs"] = "Workout logs",
            ["progress"] = "Progress measurements", ["journal"] = "Journal entries", ["healthScreenings"] = "Health check answers",
            ["emergencyContact"] = "Emergency contact", ["consents"] = "Consent history", ["waiverSignatures"] = "Signed waivers",
            ["shopOrders"] = "Shop orders", ["shopAddresses"] = "Saved addresses", ["socialPosts"] = "Social posts", ["socialComments"] = "Comments",
            ["supportRequests"] = "Help requests", ["classFeedback"] = "Class feedback",
            ["messages"] = "Conversations with trainers",
        };
        var rows = new StringBuilder();
        foreach (var key in ExportSections)
            rows.Append($"<tr><td>{WebUtility.HtmlEncode(labels.GetValueOrDefault(key, key))}</td><td style=\"text-align:right\">{CountOf(data.GetValueOrDefault(key))}</td></tr>");
        var profileJson = JsonSerializer.Serialize(data["profile"], ExportJson);
        return $"""
            <!doctype html><html lang="en"><head><meta charset="utf-8"><title>Your data from {WebUtility.HtmlEncode(gymName)}</title>
            <style>body{"{"}font-family:Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111{"}"}table{"{"}border-collapse:collapse;width:100%{"}"}td{"{"}border-bottom:1px solid #ddd;padding:6px{"}"}pre{"{"}background:#f5f5f5;padding:12px;overflow:auto{"}"}</style></head><body>
            <h1>Your data from {WebUtility.HtmlEncode(gymName)}</h1>
            <p>Prepared on {now:dd MMM yyyy HH:mm} UTC. This file is a readable overview; <b>data.json</b> in the same download has every record in full.</p>
            <h2>What's included</h2><table>{rows}</table>
            <h2>Your profile</h2><pre>{WebUtility.HtmlEncode(profileJson)}</pre>
            <p>Questions about your data? Contact your gym. You can withdraw consents or delete your account in the app under Profile → Privacy &amp; data.</p>
            </body></html>
            """;
    }
}
