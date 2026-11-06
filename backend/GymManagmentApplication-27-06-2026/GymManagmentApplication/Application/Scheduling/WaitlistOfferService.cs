using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>Per-gym notification / waitlist settings (TenantSettings key "notifications").</summary>
public class GymNotificationSettings
{
    public const string AutoPromote = "auto";
    public const string Offer = "offer";

    /// <summary>"auto" (default, the original behaviour): the first waitlisted member is booked
    /// straight away. "offer": they get a claim window and the seat is held for them.</summary>
    public string WaitlistMode { get; set; } = AutoPromote;
    /// <summary>Minutes a waitlist offer stays open (5–720, default 30).</summary>
    public int ClaimWindowMinutes { get; set; } = 30;
    /// <summary>Class and PT reminders 24 h and 2 h before start.</summary>
    public bool RemindersEnabled { get; set; } = true;
}

/// <summary>
/// What happens when a booked class spot frees up. In "auto" mode waitlisted members are booked
/// in order ("You're in!"); in "offer" mode the next one gets a <see cref="WaitlistOffer"/> with a
/// claim window, the seat is held meanwhile, and an expired/declined offer rolls to the next person.
/// Callers hold the class row lock (UnitOfWork.LockRowAsync&lt;GymClass&gt;) around every method that
/// changes seats, so offers and bookings for one class are serialised.
/// </summary>
public class WaitlistOfferService(IAppDbContext db, Notifier notifier)
{
    public const string SettingKey = "notifications";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<GymNotificationSettings> LoadSettingsAsync(IAppDbContext db, ulong tenantId, CancellationToken ct = default)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey, ct);
        var s = row?.Value?.Deserialize<GymNotificationSettings>(Json) ?? new GymNotificationSettings();
        if (s.WaitlistMode != GymNotificationSettings.Offer) s.WaitlistMode = GymNotificationSettings.AutoPromote;
        s.ClaimWindowMinutes = Math.Clamp(s.ClaimWindowMinutes, 5, 720);
        return s;
    }

    public static async Task<GymNotificationSettings> SaveSettingsAsync(IAppDbContext db, ulong tenantId, GymNotificationSettings s)
    {
        var mode = (s.WaitlistMode ?? "").Trim().ToLowerInvariant();
        if (mode is not (GymNotificationSettings.AutoPromote or GymNotificationSettings.Offer))
            throw new ArgumentException("WaitlistMode: must be auto or offer.");
        if (s.ClaimWindowMinutes is < 5 or > 720) throw new ArgumentException("ClaimWindowMinutes: between 5 and 720.");
        s.WaitlistMode = mode;
        var value = JsonSerializer.SerializeToDocument(s, Json);
        var row = await db.TenantSettings.FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Key == SettingKey);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else { row.Value = value; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync();
        return s;
    }

    /// <summary>Seats held by open offers (counted as taken while they last).</summary>
    public Task<int> HeldSeatsAsync(ulong classId, DateTime utcNow) =>
        db.WaitlistOffers.CountAsync(o => o.ClassId == classId && o.Status == WaitlistOfferStatuses.Pending && o.ExpiresAt > utcNow);

    /// <summary>True when booked seats plus held offers reach the capacity.</summary>
    public async Task<bool> IsFullAsync(GymClass c, DateTime utcNow) =>
        c.MaxCapacity is { } cap && c.Bookings.Count(b => b.Status == BookingStatus.Booked) + await HeldSeatsAsync(c.Id, utcNow) >= cap;

    /// <summary>
    /// Fills freed seats from the waitlist (class row locked, bookings loaded). Doesn't save.
    /// </summary>
    public async Task FillFreedSeatsAsync(GymClass c, DateTime utcNow)
    {
        if (c.Status == ClassStatus.Cancelled || c.StartsAt <= utcNow) { c.RecountBookings(); return; }
        var settings = await LoadSettingsAsync(db, c.TenantId);
        var name = c.Title ?? c.ClassType?.Name ?? "your class";
        var zone = await ZoneAsync(c);
        var when = Local(c.StartsAt, zone, "ddd d MMM, h:mm tt");

        var offers = await db.WaitlistOffers.Where(o => o.ClassId == c.Id).ToListAsync();
        var held = offers.Count(o => o.Status == WaitlistOfferStatuses.Pending && o.ExpiresAt > utcNow);
        var booked = c.Bookings.Count(b => b.Status == BookingStatus.Booked);
        var free = c.MaxCapacity is { } cap ? cap - booked - held : int.MaxValue;

        if (settings.WaitlistMode == GymNotificationSettings.AutoPromote)
        {
            foreach (var w in c.Bookings.Where(b => b.Status == BookingStatus.Waitlisted).OrderBy(b => b.BookedAt).ThenBy(b => b.Id).ToList())
            {
                if (free-- <= 0) break;
                w.Status = BookingStatus.Booked;
                notifier.Add(c.TenantId, w.ClientId, "You're in!", $"A spot opened up in {name} on {when}. You're booked.",
                    "waitlist", c.Id, urgent: c.StartsAt - utcNow < TimeSpan.FromHours(12));
            }
            c.RecountBookings();
            return;
        }

        var alreadyOffered = offers.Select(o => o.BookingId).ToHashSet(); // one offer per booking, ever
        var expiresAt = utcNow.AddMinutes(settings.ClaimWindowMinutes);
        if (expiresAt > c.StartsAt) expiresAt = c.StartsAt;

        foreach (var w in c.Bookings.Where(b => b.Status == BookingStatus.Waitlisted && !alreadyOffered.Contains(b.Id))
                     .OrderBy(b => b.BookedAt).ThenBy(b => b.Id).ToList())
        {
            if (free <= 0) break;
            // Too close to the start to wait for a claim: book them directly.
            if (c.StartsAt - utcNow < TimeSpan.FromMinutes(10))
            {
                w.Status = BookingStatus.Booked;
                notifier.Add(c.TenantId, w.ClientId, "You're in!", $"A spot opened up in {name} on {when}. You're booked.", "waitlist", c.Id, urgent: true);
            }
            else
            {
                db.WaitlistOffers.Add(new WaitlistOffer
                {
                    TenantId = c.TenantId, ClassId = c.Id, BookingId = w.Id, ClientId = w.ClientId,
                    OfferedAt = utcNow, ExpiresAt = expiresAt,
                });
                notifier.Add(c.TenantId, w.ClientId, "A spot opened up",
                    $"A spot opened in {name} on {when} — claim it by {Local(expiresAt, zone, "h:mmtt")}.",
                    "waitlist_offer", c.Id, urgent: true, expiresAt: expiresAt);
            }
            free--;
        }
        c.RecountBookings();
    }

    /// <summary>The member takes their offered spot (class row locked by the caller).</summary>
    /// <returns>False when the offer had already expired: it is then expired here (and rolled on) — save it.</returns>
    public async Task<bool> ClaimAsync(GymClass c, ulong clientId, DateTime utcNow)
    {
        var offer = await db.WaitlistOffers.Where(o => o.ClassId == c.Id && o.ClientId == clientId && o.Status == WaitlistOfferStatuses.Pending)
            .OrderByDescending(o => o.OfferedAt).FirstOrDefaultAsync() ?? throw new ArgumentException("There's no open spot offer for you in this class.");
        if (offer.ExpiresAt <= utcNow)
        {
            MarkExpired(c, offer, utcNow);
            await FillFreedSeatsAsync(c, utcNow);
            return false;
        }
        var booking = c.Bookings.FirstOrDefault(b => b.Id == offer.BookingId && b.Status == BookingStatus.Waitlisted)
                      ?? throw new ArgumentException("Your waitlist place was cancelled.");
        booking.Status = BookingStatus.Booked;
        offer.Status = WaitlistOfferStatuses.Claimed;
        offer.RespondedAt = utcNow;
        c.RecountBookings();
        return true;
    }

    /// <summary>The member passes: their waitlist place is released and the spot rolls on.</summary>
    public async Task DeclineAsync(GymClass c, ulong clientId, DateTime utcNow)
    {
        var offer = await db.WaitlistOffers.Where(o => o.ClassId == c.Id && o.ClientId == clientId && o.Status == WaitlistOfferStatuses.Pending)
            .OrderByDescending(o => o.OfferedAt).FirstOrDefaultAsync() ?? throw new ArgumentException("There's no open spot offer for you in this class.");
        offer.Status = WaitlistOfferStatuses.Declined;
        offer.RespondedAt = utcNow;
        ReleaseBooking(c, offer.BookingId, utcNow);
        await FillFreedSeatsAsync(c, utcNow);
    }

    /// <summary>A booking left the waitlist (cancelled): its open offer is withdrawn and the seat freed.</summary>
    public async Task WithdrawForBookingAsync(ulong bookingId, DateTime utcNow)
    {
        foreach (var o in await db.WaitlistOffers.Where(o => o.BookingId == bookingId && o.Status == WaitlistOfferStatuses.Pending).ToListAsync())
        {
            o.Status = WaitlistOfferStatuses.Withdrawn;
            o.RespondedAt = utcNow;
        }
    }

    /// <summary>Every pending offer of a class is withdrawn (class cancelled).</summary>
    public async Task WithdrawForClassAsync(ulong classId, DateTime utcNow)
    {
        foreach (var o in await db.WaitlistOffers.Where(o => o.ClassId == classId && o.Status == WaitlistOfferStatuses.Pending).ToListAsync())
        {
            o.Status = WaitlistOfferStatuses.Withdrawn;
            o.RespondedAt = utcNow;
        }
    }

    /// <summary>
    /// Scheduler: classes with a pending offer past its window. For each, the caller locks the class
    /// row and calls <see cref="ExpireDueForClassAsync"/>.
    /// </summary>
    public Task<List<ulong>> ClassesWithExpiredOffersAsync(DateTime utcNow, CancellationToken ct = default) =>
        db.WaitlistOffers.IgnoreQueryFilters()
            .Where(o => o.Status == WaitlistOfferStatuses.Pending && o.ExpiresAt <= utcNow)
            .Select(o => o.ClassId).Distinct().ToListAsync(ct);

    /// <summary>Expires the class's lapsed offers and rolls the seats on (class row locked). Saves.</summary>
    public async Task<int> ExpireDueForClassAsync(ulong classId, DateTime utcNow, CancellationToken ct = default)
    {
        var c = await db.GymClasses.IgnoreQueryFilters().Include(x => x.ClassType).Include(x => x.Branch).Include(x => x.Bookings)
            .FirstOrDefaultAsync(x => x.Id == classId, ct);
        if (c is null) return 0;
        var due = await db.WaitlistOffers.Where(o => o.ClassId == classId && o.Status == WaitlistOfferStatuses.Pending && o.ExpiresAt <= utcNow).ToListAsync(ct);
        foreach (var o in due) MarkExpired(c, o, utcNow);
        await FillFreedSeatsAsync(c, utcNow);
        await db.SaveChangesAsync(ct);
        return due.Count;
    }

    private void MarkExpired(GymClass c, WaitlistOffer o, DateTime utcNow)
    {
        o.Status = WaitlistOfferStatuses.Expired;
        o.RespondedAt = utcNow;
        ReleaseBooking(c, o.BookingId, utcNow);
        if (c.Status != ClassStatus.Cancelled && c.StartsAt > utcNow)
            notifier.Add(c.TenantId, o.ClientId, "Spot offer expired",
                $"The spot in {c.Title ?? c.ClassType?.Name ?? "your class"} wasn't claimed in time, so it went to the next person.",
                "waitlist", c.Id);
    }

    /// <summary>An unclaimed / declined offer ends that member's waitlist place.</summary>
    private static void ReleaseBooking(GymClass c, ulong bookingId, DateTime utcNow)
    {
        var b = c.Bookings.FirstOrDefault(x => x.Id == bookingId && x.Status == BookingStatus.Waitlisted);
        if (b is null) return;
        b.Status = BookingStatus.Cancelled;
        b.CancelledAt = utcNow;
    }

    private async Task<TimeZoneInfo> ZoneAsync(GymClass c)
    {
        var branchTz = c.Branch?.Timezone
                       ?? await db.Branches.IgnoreQueryFilters().Where(b => b.Id == c.BranchId).Select(b => b.Timezone).FirstOrDefaultAsync();
        if (!string.IsNullOrWhiteSpace(branchTz) && branchTz != "UTC") return TenantClock.Resolve(branchTz);
        return (await TenantClock.ForAsync(db, c.TenantId)).Zone;
    }

    private static string Local(DateTime utc, TimeZoneInfo zone, string format) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone).ToString(format, CultureInfo.InvariantCulture)
            .Replace("AM", "am").Replace("PM", "pm");
}
