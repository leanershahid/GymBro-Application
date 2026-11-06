using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;

namespace GymManagmentApplication.Application.SelfService;

/// <summary>
/// The pure calculations behind self-service (no I/O, unit-tested): join quotes, cancellation end
/// dates, freeze allowance and plan-change pro-rating. Money is rounded like invoices (Money.Round).
/// </summary>
public static class MembershipMath
{
    // ── Join quote ──────────────────────────────────────────────────────────

    public sealed record JoinTotals(decimal PlanPrice, decimal JoiningFee, decimal Subtotal, decimal Discount,
        decimal TaxPercent, decimal Tax, decimal Total);

    /// <summary>
    /// Same order as BillingCore.CreateInvoiceAsync: subtotal (plan + joining fee) − discount, then tax
    /// on what is left. The coupon discount applies to the plan price only, never the joining fee.
    /// </summary>
    public static JoinTotals Join(decimal planPrice, decimal joiningFee, decimal taxPercent, Coupon? coupon)
    {
        var subtotal = Money.Round(planPrice + joiningFee);
        var discount = coupon is null ? 0 : CouponRules.CalculateDiscount(coupon, planPrice);
        var tax = Money.Round((subtotal - discount) * taxPercent / 100m);
        return new JoinTotals(Money.Round(planPrice), Money.Round(joiningFee), subtotal, discount, taxPercent, tax, subtotal - discount + tax);
    }

    // ── Cancellation ────────────────────────────────────────────────────────

    /// <param name="LastDay">Last day the member can train; the membership is cancelled the day after.</param>
    /// <param name="NoticeEnd">today + notice days (null when there is no notice period).</param>
    /// <param name="MinimumTermEnd">Last day of the minimum term (null when none).</param>
    /// <param name="UncoveredDays">Days between the paid-through date and <paramref name="LastDay"/> that still need paying.</param>
    public sealed record CancelPlan(DateOnly LastDay, DateOnly? NoticeEnd, DateOnly? MinimumTermEnd, DateOnly? PaidThrough,
        int UncoveredDays, decimal UncoveredCharge, decimal CancellationFee)
    {
        public decimal FinalCharge => UncoveredCharge + CancellationFee;
    }

    /// <summary>
    /// When access ends if the member cancels today: the latest of the paid-through date (no refunds for
    /// days already paid), today + notice, and the end of the minimum term. Days past the paid-through
    /// date are charged pro rata at the plan's daily rate, plus any cancellation fee.
    /// </summary>
    public static CancelPlan Cancel(DateOnly today, DateOnly startsAt, DateOnly? endsAt, decimal planPrice, int cycleDays,
        MembershipRulesSettings rules)
    {
        DateOnly? noticeEnd = rules.NoticeDays > 0 ? today.AddDays(rules.NoticeDays) : null;
        DateOnly? termEnd = rules.MinimumTermMonths > 0 ? startsAt.AddMonths(rules.MinimumTermMonths).AddDays(-1) : null;
        var last = today;
        if (endsAt is { } paid && paid > last) last = paid;
        if (noticeEnd is { } n && n > last) last = n;
        if (termEnd is { } t && t > last) last = t;
        var uncovered = endsAt is { } e ? Math.Max(0, last.DayNumber - e.DayNumber) : 0;
        var charge = uncovered == 0 ? 0 : Money.Round(planPrice / Math.Max(1, cycleDays) * uncovered);
        return new CancelPlan(last, noticeEnd, termEnd, endsAt, uncovered, charge, rules.CancellationFee);
    }

    // ── Freeze ──────────────────────────────────────────────────────────────

    /// <summary>Inclusive length of a pause.</summary>
    public static int FreezeDays(DateOnly from, DateOnly to) => to.DayNumber - from.DayNumber + 1;

    /// <summary>Freeze days of <paramref name="year"/> taken by the given pauses (only the part inside that year counts).</summary>
    public static int DaysInYear(IEnumerable<(DateOnly From, DateOnly To)> pauses, int year)
    {
        var first = new DateOnly(year, 1, 1);
        var last = new DateOnly(year, 12, 31);
        return pauses.Sum(p =>
        {
            var a = p.From > first ? p.From : first;
            var b = p.To < last ? p.To : last;
            return b < a ? 0 : FreezeDays(a, b);
        });
    }

    /// <summary>Why this pause isn't allowed, or null. <paramref name="usedThisYear"/> = days already used/booked in the start year.</summary>
    public static string? FreezeProblem(DateOnly today, DateOnly from, DateOnly to, int usedThisYear, MembershipRulesSettings rules,
        DateOnly? membershipEndsAt)
    {
        if (rules.MaxFreezeDaysPerYear <= 0) return "Your gym doesn't offer pausing in the app. Please speak to the front desk.";
        if (from < today) return "Pick a start date from today onwards.";
        if (to < from) return "The end date must be on or after the start date.";
        if (membershipEndsAt is { } end && from > end) return $"Your membership ends on {end:dd MMM yyyy}, so the pause must start before then.";
        var days = FreezeDays(from, to);
        if (days < rules.MinFreezeDays) return $"A pause must be at least {rules.MinFreezeDays} day{(rules.MinFreezeDays == 1 ? "" : "s")}.";
        var thisYear = DaysInYear([(from, to)], from.Year);
        var left = Math.Max(0, rules.MaxFreezeDaysPerYear - usedThisYear);
        if (thisYear > left || days > rules.MaxFreezeDaysPerYear)
            return left == 0
                ? $"You've used all {rules.MaxFreezeDaysPerYear} pause days for {from.Year}."
                : $"You have {left} pause day{(left == 1 ? "" : "s")} left for {from.Year}; this pause is {days} days.";
        return null;
    }

    // ── Plan change ─────────────────────────────────────────────────────────

    public static decimal DailyRate(decimal price, int cycleDays) => price / Math.Max(1, cycleDays);

    /// <summary>A change to a plan with a higher daily rate is an upgrade (now); anything else waits for renewal.</summary>
    public static bool IsUpgrade(decimal oldPrice, int oldDays, decimal newPrice, int newDays) =>
        DailyRate(newPrice, newDays) > DailyRate(oldPrice, oldDays);

    /// <summary>
    /// Pro-rated charge for upgrading today: the difference in daily rate for the days left in the
    /// current (already paid) period, from today to the end date inclusive. Never negative.
    /// </summary>
    public static (int DaysLeft, decimal Charge) UpgradeCharge(DateOnly today, DateOnly? endsAt, decimal oldPrice, int oldDays,
        decimal newPrice, int newDays)
    {
        if (endsAt is not { } end || end < today) return (0, 0);
        var daysLeft = end.DayNumber - today.DayNumber + 1;
        var diff = (DailyRate(newPrice, newDays) - DailyRate(oldPrice, oldDays)) * daysLeft;
        return (daysLeft, diff <= 0 ? 0 : Money.Round(diff));
    }
}
