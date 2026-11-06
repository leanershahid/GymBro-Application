using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>Per-gym cancellation and no-show rules (TenantSettings key "booking-rules").</summary>
public class BookingRulesSettings
{
    public const string None = "none";
    public const string Fee = "fee";
    /// <summary>Not offered while class credits aren't consumed on booking (see <see cref="BookingPenaltyEngine.CreditsSupported"/>).</summary>
    public const string LoseCredit = "lose_credit";
    public const string StrikeOnly = "strike";

    /// <summary>Members can cancel a class for free until this many hours before it starts (0–168, default 2).</summary>
    public int ClassCancelCutoffHours { get; set; } = 2;
    /// <summary>Same for personal training (0–168, default 24).</summary>
    public int PtCancelCutoffHours { get; set; } = 24;
    /// <summary>none | fee (| lose_credit once credits exist). Default none.</summary>
    public string LateCancelConsequence { get; set; } = None;
    public decimal LateCancelFee { get; set; }
    /// <summary>none | fee | strike (| lose_credit once credits exist). Default strike.</summary>
    public string NoShowConsequence { get; set; } = StrikeOnly;
    public decimal NoShowFee { get; set; }
    /// <summary>Strikes inside the window that pause self-booking (1–20, default 3).</summary>
    public int StrikesBeforeBlock { get; set; } = 3;
    /// <summary>Rolling strike window in days (1–365, default 30).</summary>
    public int StrikeWindowDays { get; set; } = 30;
    /// <summary>How long a booking block lasts (1–90 days, default 7).</summary>
    public int BlockDays { get; set; } = 7;
    /// <summary>When false only gym admins (not delegated staff roles) can waive penalties.</summary>
    public bool StaffCanWaive { get; set; } = true;
    /// <summary>Mark still-"Booked" members as no-shows when a class's attendance was never taken.</summary>
    public bool AutoNoShowEnabled { get; set; }
    /// <summary>Minutes after the class ends before the automatic no-show runs (0–1440, default 60).</summary>
    public int AutoNoShowAfterMinutes { get; set; } = 60;
    /// <summary>Set by the server when the automatic no-show is switched on: only classes ending after it are swept.</summary>
    public DateTime? AutoNoShowSince { get; set; }
}

/// <summary>What a cancel right now would cost (the 409 LATE_CANCEL_CONFIRM payload).</summary>
public sealed record LateCancelInfo(bool IsLate, string Consequence, decimal? Fee, string Currency, int CutoffHours, DateTime FreeCancelUntil, DateTime StartsAt);

/// <summary>What the penalty is for.</summary>
public sealed record PenaltySubject(
    ulong TenantId, ulong ClientId, string Type, DateTime StartsAt, string Label,
    ulong? BookingId = null, ulong? ClassId = null, ulong? PtSessionId = null, ulong? CreatedBy = null);

/// <summary>
/// Cancellation and no-show rules: the late-cancel cut-off, recording a <see cref="BookingPenalty"/>
/// (fee invoice through <see cref="BillingCore"/> and/or a strike), turning strikes in the rolling
/// window into a <see cref="BookingBlock"/>, waiving and lifting. One row per booking / PT session
/// and type (unique index + a lookup first), so repeating an attendance mark is a no-op.
/// Callers hold their usual row lock (class / session) and transaction.
/// </summary>
public class BookingPenaltyEngine(IAppDbContext db, Notifier notifier)
{
    public const string SettingKey = "booking-rules";
    public const string LateCancelConfirmCode = "LATE_CANCEL_CONFIRM";
    public const string BookingBlockedCode = "BOOKING_BLOCKED";
    /// <summary>Notification kind → push route "my-bookings".</summary>
    public const string NotificationKind = "booking_penalty";
    /// <summary>Class credits (MembershipPlan.ClassCredits) are not consumed by any booking yet, so "lose credit" is not offered.</summary>
    public const bool CreditsSupported = false;
    /// <summary>The automatic no-show looks back at most this far.</summary>
    public static readonly TimeSpan AutoNoShowLookBack = TimeSpan.FromDays(7);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly BillingCore billing = new(db, notifier);

    // ── Settings ────────────────────────────────────────────────────────────

    public static async Task<BookingRulesSettings> LoadSettingsAsync(IAppDbContext db, ulong tenantId, CancellationToken ct = default)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey, ct);
        BookingRulesSettings s;
        try { s = row?.Value?.Deserialize<BookingRulesSettings>(Json) ?? new BookingRulesSettings(); }
        catch (JsonException) { s = new BookingRulesSettings(); }
        return s;
    }

    /// <summary>Validates and stores the settings (caller audits). Keeps AutoNoShowSince server-side.</summary>
    public static async Task<BookingRulesSettings> SaveSettingsAsync(IAppDbContext db, ulong tenantId, BookingRulesSettings s, DateTime utcNow)
    {
        string Consequence(string? v, string field, bool allowStrike)
        {
            var c = (v ?? "").Trim().ToLowerInvariant();
            if (c == BookingRulesSettings.LoseCredit)
                throw new ArgumentException($"{field}: \"lose credit\" isn't available — class credits aren't used for bookings yet.");
            if (c is not (BookingRulesSettings.None or BookingRulesSettings.Fee) && !(allowStrike && c == BookingRulesSettings.StrikeOnly))
                throw new ArgumentException($"{field}: must be {(allowStrike ? "none, fee or strike" : "none or fee")}.");
            return c;
        }
        s.LateCancelConsequence = Consequence(s.LateCancelConsequence, "LateCancelConsequence", false);
        s.NoShowConsequence = Consequence(s.NoShowConsequence, "NoShowConsequence", true);
        if (s.ClassCancelCutoffHours is < 0 or > 168) throw new ArgumentException("ClassCancelCutoffHours: between 0 and 168.");
        if (s.PtCancelCutoffHours is < 0 or > 168) throw new ArgumentException("PtCancelCutoffHours: between 0 and 168.");
        if (s.LateCancelFee is < 0 or > 1_000_000) throw new ArgumentException("LateCancelFee: between 0 and 1,000,000.");
        if (s.NoShowFee is < 0 or > 1_000_000) throw new ArgumentException("NoShowFee: between 0 and 1,000,000.");
        if (s.LateCancelConsequence == BookingRulesSettings.Fee && s.LateCancelFee <= 0) throw new ArgumentException("LateCancelFee: set the late-cancel fee.");
        if (s.NoShowConsequence == BookingRulesSettings.Fee && s.NoShowFee <= 0) throw new ArgumentException("NoShowFee: set the no-show fee.");
        if (s.StrikesBeforeBlock is < 1 or > 20) throw new ArgumentException("StrikesBeforeBlock: between 1 and 20.");
        if (s.StrikeWindowDays is < 1 or > 365) throw new ArgumentException("StrikeWindowDays: between 1 and 365.");
        if (s.BlockDays is < 1 or > 90) throw new ArgumentException("BlockDays: between 1 and 90.");
        if (s.AutoNoShowAfterMinutes is < 0 or > 1440) throw new ArgumentException("AutoNoShowAfterMinutes: between 0 and 1440.");
        s.LateCancelFee = BillingCore.Round(s.LateCancelFee);
        s.NoShowFee = BillingCore.Round(s.NoShowFee);

        var previous = await LoadSettingsAsync(db, tenantId);
        s.AutoNoShowSince = !s.AutoNoShowEnabled ? null : previous.AutoNoShowEnabled ? previous.AutoNoShowSince ?? utcNow : utcNow;

        var value = JsonSerializer.SerializeToDocument<BookingRulesSettings>(s, Json);
        var row = await db.TenantSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Key == SettingKey);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else { row.Value = value; row.UpdatedAt = utcNow; }
        await db.SaveChangesAsync();
        return s;
    }

    /// <summary>The consequence that actually applies (a fee of 0 or an unsupported option is "none").</summary>
    public static string EffectiveLateCancel(BookingRulesSettings s) =>
        s.LateCancelConsequence == BookingRulesSettings.Fee && s.LateCancelFee > 0 ? BookingRulesSettings.Fee : BookingRulesSettings.None;

    public static string EffectiveNoShow(BookingRulesSettings s) => s.NoShowConsequence switch
    {
        BookingRulesSettings.Fee when s.NoShowFee > 0 => BookingRulesSettings.Fee,
        BookingRulesSettings.StrikeOnly => BookingRulesSettings.StrikeOnly,
        _ => BookingRulesSettings.None,
    };

    // ── Cut-off ─────────────────────────────────────────────────────────────

    public static DateTime FreeCancelUntil(DateTime startsAt, int cutoffHours) => startsAt.AddHours(-cutoffHours);

    /// <summary>Late = after the free-cancellation instant (cancelling exactly at it is still free).</summary>
    public static bool IsLate(DateTime startsAt, int cutoffHours, DateTime utcNow) => utcNow > FreeCancelUntil(startsAt, cutoffHours);

    public async Task<LateCancelInfo> LateCancelAsync(ulong tenantId, DateTime startsAt, bool pt, DateTime utcNow, BookingRulesSettings? settings = null)
    {
        var s = settings ?? await LoadSettingsAsync(db, tenantId);
        var cutoff = pt ? s.PtCancelCutoffHours : s.ClassCancelCutoffHours;
        var consequence = EffectiveLateCancel(s);
        return new LateCancelInfo(IsLate(startsAt, cutoff, utcNow), consequence,
            consequence == BookingRulesSettings.Fee ? s.LateCancelFee : null, await CurrencyAsync(tenantId),
            cutoff, FreeCancelUntil(startsAt, cutoff), startsAt);
    }

    /// <summary>The 409 the member answers with "Cancel anyway" (confirmLate=true).</summary>
    public static RuleException ConfirmRequired(LateCancelInfo info)
    {
        var within = info.CutoffHours == 1 ? "1 hour" : $"{info.CutoffHours} hours";
        var what = info.Consequence == BookingRulesSettings.Fee
            ? $"A late cancellation fee of {info.Fee:N2} {info.Currency} applies."
            : "A late cancellation is recorded.";
        return new RuleException($"You're cancelling within {within} of the start. {what}", RuleException.ConflictStatus)
        {
            Code = LateCancelConfirmCode,
            Payload = new
            {
                consequence = info.Consequence, fee = info.Fee, currency = info.Currency,
                cutoffHours = info.CutoffHours, freeCancelUntil = info.FreeCancelUntil, startsAt = info.StartsAt,
            },
        };
    }

    // ── Blocks ──────────────────────────────────────────────────────────────

    public Task<BookingBlock?> ActiveBlockAsync(ulong tenantId, ulong clientId, DateTime utcNow) =>
        db.BookingBlocks.AcrossTenants()
            .Where(b => b.TenantId == tenantId && b.ClientId == clientId && b.LiftedAt == null && b.From <= utcNow && b.Until > utcNow)
            .OrderByDescending(b => b.Until).FirstOrDefaultAsync();

    /// <summary>Members booking themselves: 422 BOOKING_BLOCKED while a block runs. Staff bookings skip this.</summary>
    public async Task EnsureCanSelfBookAsync(ulong tenantId, ulong clientId, DateTime utcNow)
    {
        if (await ActiveBlockAsync(tenantId, clientId, utcNow) is not { } block) return;
        var zone = (await TenantClock.ForAsync(db, tenantId)).Zone;
        throw new RuleException(
            $"Booking is paused until {Local(block.Until, zone, "ddd d MMM, h:mm tt")} ({block.Reason}). Staff can still book for you — contact the gym.",
            RuleException.UnprocessableStatus)
        {
            Code = BookingBlockedCode,
            Payload = new { until = block.Until, reason = block.Reason, blockId = block.Id },
        };
    }

    /// <summary>Strikes that count towards the next block: not waived, inside the window, after the last block started.</summary>
    public async Task<int> CountStrikesAsync(ulong tenantId, ulong clientId, DateTime asOf, BookingRulesSettings s)
    {
        var since = asOf.AddDays(-s.StrikeWindowDays);
        var lastBlock = await db.BookingBlocks.AcrossTenants()
            .Where(b => b.TenantId == tenantId && b.ClientId == clientId && b.CreatedAt < asOf)
            .OrderByDescending(b => b.CreatedAt).Select(b => (DateTime?)b.CreatedAt).FirstOrDefaultAsync();
        if (lastBlock is { } lb && lb > since) since = lb;
        return await db.BookingPenalties.AcrossTenants()
            .CountAsync(p => p.TenantId == tenantId && p.ClientId == clientId && p.Strike && !p.Waived
                             && p.CreatedAt > since && p.CreatedAt <= asOf);
    }

    // ── Applying ────────────────────────────────────────────────────────────

    /// <summary>
    /// Records the consequence of a late cancel / no-show (and saves). Returns null when nothing
    /// applies or it was already recorded for this booking / session (idempotent).
    /// </summary>
    public async Task<BookingPenalty?> ApplyAsync(PenaltySubject subject, DateTime utcNow)
    {
        if (await ExistingAsync(subject.TenantId, subject.Type, subject.BookingId, subject.PtSessionId) is not null) return null;

        var s = await LoadSettingsAsync(db, subject.TenantId);
        var lateCancel = subject.Type == BookingPenaltyTypes.LateCancel;
        var consequence = lateCancel ? EffectiveLateCancel(s) : EffectiveNoShow(s);
        if (consequence == BookingRulesSettings.None) return null;

        var penalty = new BookingPenalty
        {
            TenantId = subject.TenantId, ClientId = subject.ClientId, Type = subject.Type,
            BookingId = subject.BookingId, ClassId = subject.ClassId, PtSessionId = subject.PtSessionId,
            SessionStartsAt = subject.StartsAt, CreatedAt = utcNow, CreatedBy = subject.CreatedBy,
            Strike = consequence == BookingRulesSettings.StrikeOnly,
        };
        var zone = (await TenantClock.ForAsync(db, subject.TenantId)).Zone;
        var when = Local(subject.StartsAt, zone, "ddd d MMM, h:mm tt");
        var what = lateCancel ? "Late cancellation" : "No-show";

        if (consequence == BookingRulesSettings.Fee)
        {
            var fee = lateCancel ? s.LateCancelFee : s.NoShowFee;
            var invoice = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(subject.TenantId, subject.ClientId,
                [new InvoiceLineItem { Description = $"{what} fee — {subject.Label}, {when}", UnitPrice = fee, Quantity = 1 }],
                DueDate: DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, zone)).AddDays(7),
                Notes: $"Booking penalty ({subject.Type})"));
            penalty.FeeAmount = fee;
            penalty.FeeInvoice = invoice;
            notifier.Add(subject.TenantId, subject.ClientId, $"{what} fee",
                $"{subject.Label} on {when}: a {fee:N2} {invoice.Currency} fee was added to your invoices.",
                NotificationKind, null, category: NotificationCategories.Billing);
        }
        db.BookingPenalties.Add(penalty);
        await db.SaveChangesAsync();

        if (penalty.Strike)
        {
            var strikes = await CountStrikesAsync(subject.TenantId, subject.ClientId, utcNow, s);
            var blocked = strikes >= s.StrikesBeforeBlock && await ActiveBlockAsync(subject.TenantId, subject.ClientId, utcNow) is null;
            notifier.Add(subject.TenantId, subject.ClientId, "No-show recorded",
                $"You missed {subject.Label} on {when}. That's {Math.Min(strikes, s.StrikesBeforeBlock)} of {s.StrikesBeforeBlock} no-shows in the last {s.StrikeWindowDays} days.",
                NotificationKind, null, category: NotificationCategories.General);
            if (blocked)
            {
                var block = new BookingBlock
                {
                    TenantId = subject.TenantId, ClientId = subject.ClientId, From = utcNow, Until = utcNow.AddDays(s.BlockDays),
                    Reason = $"{strikes} no-shows in {s.StrikeWindowDays} days", CreatedAt = utcNow,
                };
                db.BookingBlocks.Add(block);
                notifier.Add(subject.TenantId, subject.ClientId, "Booking paused",
                    $"After {strikes} no-shows you can't book classes or personal training yourself until {Local(block.Until, zone, "ddd d MMM, h:mm tt")}. Contact the gym if this is a mistake.",
                    NotificationKind, null, category: NotificationCategories.General);
            }
            await db.SaveChangesAsync();
        }
        return penalty;
    }

    public Task<BookingPenalty?> ExistingAsync(ulong tenantId, string type, ulong? bookingId, ulong? ptSessionId) =>
        db.BookingPenalties.AcrossTenants().FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Type == type
            && (bookingId != null ? p.BookingId == bookingId : p.PtSessionId == ptSessionId));

    // ── Waive / lift ────────────────────────────────────────────────────────

    /// <summary>
    /// Waives a penalty (doesn't save): an unpaid fee invoice is voided, and a block that this
    /// strike helped cause is lifted when the remaining strikes fall under the threshold.
    /// Returns whether the fee invoice was voided (false when there was none or it is already paid).
    /// </summary>
    public async Task<bool> WaiveAsync(BookingPenalty p, ulong? actorId, string reason, DateTime utcNow)
    {
        if (p.Waived) return false;
        p.Waived = true;
        p.WaivedAt = utcNow;
        p.WaivedBy = actorId;
        p.WaiveReason = reason.Trim();
        var voided = false;
        if (p.FeeInvoiceId is { } invoiceId
            && await db.Invoices.AcrossTenants().FirstOrDefaultAsync(i => i.Id == invoiceId && i.TenantId == p.TenantId) is { } inv
            && inv.AmountPaid == 0 && inv.Status is InvoiceStatus.Draft or InvoiceStatus.Sent or InvoiceStatus.Overdue)
        {
            inv.Status = InvoiceStatus.Void;
            voided = true;
        }
        await db.SaveChangesAsync(); // the strike count below must see this waiver

        if (p.Strike)
        {
            var s = await LoadSettingsAsync(db, p.TenantId);
            var blocks = await db.BookingBlocks.AcrossTenants()
                .Where(b => b.TenantId == p.TenantId && b.ClientId == p.ClientId && b.LiftedAt == null && b.Until > utcNow && b.CreatedAt >= p.CreatedAt)
                .ToListAsync();
            foreach (var b in blocks)
                if (await CountStrikesAsync(p.TenantId, p.ClientId, b.CreatedAt, s) < s.StrikesBeforeBlock)
                    Lift(b, actorId, "A strike behind it was waived", utcNow);
        }
        notifier.Add(p.TenantId, p.ClientId, "Penalty waived",
            p.FeeInvoiceId is null ? "The gym waived a no-show / late-cancel penalty on your account."
                : voided ? "The gym waived a booking fee; its invoice was voided."
                : "The gym waived a booking penalty.",
            NotificationKind, null, category: NotificationCategories.General);
        return voided;
    }

    /// <summary>Ends a block early (doesn't save).</summary>
    public void Lift(BookingBlock b, ulong? actorId, string reason, DateTime utcNow)
    {
        if (b.LiftedAt is not null) return;
        b.LiftedAt = utcNow;
        b.LiftedBy = actorId;
        b.LiftReason = reason.Trim();
        b.EndNotifiedAt = utcNow;
        notifier.Add(b.TenantId, b.ClientId, "You can book again", "The gym lifted your booking pause.",
            NotificationKind, null, category: NotificationCategories.General);
    }

    /// <summary>A no-show corrected to attended / completed: its penalty is waived automatically (doesn't save).</summary>
    public async Task UndoNoShowAsync(ulong tenantId, ulong? bookingId, ulong? ptSessionId, ulong? actorId, DateTime utcNow)
    {
        if (await ExistingAsync(tenantId, BookingPenaltyTypes.NoShow, bookingId, ptSessionId) is { Waived: false } p)
            await WaiveAsync(p, actorId, "Attendance corrected", utcNow);
    }

    // ── Background: automatic no-shows, block-ended notices ─────────────────

    /// <summary>
    /// For one gym: classes that ended at least AutoNoShowAfterMinutes ago (and after the setting
    /// was switched on, within the last 7 days) whose attendance was never taken — every booking
    /// still "Booked" — get those bookings marked NoShow with the usual penalty. Returns how many.
    /// </summary>
    public async Task<int> RunAutoNoShowAsync(ulong tenantId, DateTime utcNow, CancellationToken ct = default)
    {
        var s = await LoadSettingsAsync(db, tenantId, ct);
        if (!s.AutoNoShowEnabled) return 0;
        var endedBefore = utcNow.AddMinutes(-s.AutoNoShowAfterMinutes);
        var endedAfter = utcNow - AutoNoShowLookBack;
        if (s.AutoNoShowSince is { } since && since > endedAfter) endedAfter = since;
        var classIds = await db.GymClasses.AcrossTenants()
            .Where(c => c.TenantId == tenantId && c.Status != ClassStatus.Cancelled && c.EndsAt <= endedBefore && c.EndsAt > endedAfter
                        && c.Bookings.Any(b => b.Status == BookingStatus.Booked)
                        && !c.Bookings.Any(b => b.Status == BookingStatus.Attended || b.Status == BookingStatus.NoShow))
            .OrderBy(c => c.EndsAt).Select(c => c.Id).Take(200).ToListAsync(ct);

        var marked = 0;
        foreach (var id in classIds)
        {
            marked += await db.InTransactionAsync(async () =>
            {
                await db.LockRowAsync<GymClass>(id, ct);
                var c = await db.GymClasses.AcrossTenants().Include(x => x.ClassType).Include(x => x.Bookings)
                    .FirstAsync(x => x.Id == id && x.TenantId == tenantId, ct);
                if (c.Bookings.Any(b => b.Status is BookingStatus.Attended or BookingStatus.NoShow)) return 0; // staff got there first
                var booked = c.Bookings.Where(b => b.Status == BookingStatus.Booked).ToList();
                foreach (var b in booked) b.Status = BookingStatus.NoShow;
                c.RecountBookings();
                await db.SaveChangesAsync(ct);
                foreach (var b in booked)
                    await ApplyAsync(new PenaltySubject(tenantId, b.ClientId, BookingPenaltyTypes.NoShow, c.StartsAt,
                        c.Title ?? c.ClassType.Name, BookingId: b.Id, ClassId: c.Id), utcNow);
                return booked.Count;
            }, ct: ct);
        }
        return marked;
    }

    /// <summary>Tells members whose block ran out that they can book again. Returns how many.</summary>
    public async Task<int> NotifyEndedBlocksAsync(ulong tenantId, DateTime utcNow, CancellationToken ct = default)
    {
        var ended = await db.BookingBlocks.AcrossTenants()
            .Where(b => b.TenantId == tenantId && b.LiftedAt == null && b.EndNotifiedAt == null && b.Until <= utcNow)
            .Take(500).ToListAsync(ct);
        foreach (var b in ended)
        {
            b.EndNotifiedAt = utcNow;
            // Another block may already have taken over (rare); only announce a real end.
            if (await ActiveBlockAsync(tenantId, b.ClientId, utcNow) is not null) continue;
            notifier.Add(tenantId, b.ClientId, "You can book again", "Your booking pause has ended.",
                NotificationKind, null, category: NotificationCategories.General);
        }
        if (ended.Count > 0) await db.SaveChangesAsync(ct);
        return ended.Count;
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private async Task<string> CurrencyAsync(ulong tenantId) =>
        await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == tenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";

    public static string Local(DateTime utc, TimeZoneInfo zone, string format) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString(format, CultureInfo.InvariantCulture);
}
