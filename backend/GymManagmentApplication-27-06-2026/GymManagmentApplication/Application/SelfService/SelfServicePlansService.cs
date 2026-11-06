using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.SelfService;

/// <summary>
/// Member self-service, part 1: browse the gym's public plans, get a server quote, and check out.
/// Checkout creates a Pending membership + its invoice and hands back a Razorpay order; the
/// membership turns Active only when that invoice is paid (verify / webhook / desk), through
/// <see cref="BillingCore.ActivatePaidMembershipAsync"/>. Without an online gateway the member pays at
/// the front desk and staff are told.
/// </summary>
public class SelfServicePlansService(
    IAppDbContext db,
    ICurrentUser currentUser,
    BillingCore billing,
    PaymentService payments,
    SafetyGate safety,
    ConsentService consents,
    Notifier notifier)
{
    /// <summary>Current version of the membership terms the checkbox agrees to.</summary>
    public const string TermsVersion = "membership-1";

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    // ── Plans ───────────────────────────────────────────────────────────────

    public async Task<PlanCatalogResponse> GetCatalogAsync()
    {
        var tenantId = TenantId;
        var rules = await MembershipRulesStore.LoadAsync(db, tenantId);
        var live = await SelfServiceCommon.LiveMembershipAsync(db, Me);
        var plans = (await (await PublicPlansQueryAsync(tenantId)).ToListAsync()).OrderBy(p => p.SortOrder).ThenBy(p => p.Price).ToList();
        var branchNames = await BranchNamesAsync(plans);
        var currency = await db.Tenants.Where(t => t.Id == tenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";
        return new PlanCatalogResponse
        {
            Plans = plans.Select(p =>
            {
                var r = SelfServiceCommon.MapPlan(p, p.BranchId is { } b ? branchNames.GetValueOrDefault(b) : null);
                r.IsCurrent = live?.PlanId == p.Id;
                return r;
            }).ToList(),
            Rules = MemberRulesResponse.From(rules),
            OnlinePayments = await payments.ActiveGatewayAsync(tenantId) is not null,
            Currency = currency,
        };
    }

    /// <summary>Active plans the gym shows online; a branch-only plan is offered to that branch's members (and to members with no branch).</summary>
    private async Task<IQueryable<MembershipPlan>> PublicPlansQueryAsync(ulong tenantId)
    {
        var myBranch = await db.Users.Where(u => u.Id == Me).Select(u => u.BranchId).FirstOrDefaultAsync();
        return db.MembershipPlans
            .Where(p => p.TenantId == tenantId && p.IsActive && p.IsPublic
                        && (p.BranchId == null || myBranch == null || p.BranchId == myBranch));
    }

    private async Task<Dictionary<ulong, string>> BranchNamesAsync(IEnumerable<MembershipPlan> plans)
    {
        var ids = plans.Where(p => p.BranchId != null).Select(p => p.BranchId!.Value).Distinct().ToList();
        return ids.Count == 0 ? [] : await db.Branches.Where(b => ids.Contains(b.Id)).ToDictionaryAsync(b => b.Id, b => b.Name);
    }

    // ── Quote ───────────────────────────────────────────────────────────────

    private sealed record Priced(JoinQuoteResponse Quote, MembershipPlan Plan, Coupon? Coupon, MembershipRulesSettings Rules);

    public async Task<JoinQuoteResponse> QuoteAsync(JoinQuoteRequest r) => (await PriceAsync(r)).Quote;

    private async Task<Priced> PriceAsync(JoinQuoteRequest r)
    {
        var tenantId = TenantId;
        var me = Me;
        var rules = await MembershipRulesStore.LoadAsync(db, tenantId);
        var plan = await (await PublicPlansQueryAsync(tenantId)).FirstOrDefaultAsync(p => p.Id == r.PlanId)
                   ?? throw new KeyNotFoundException("That plan isn't available online. Pick another plan or ask the front desk.");

        var today = (await TenantClock.ForAsync(db, tenantId)).Today;
        var start = r.StartDate ?? today;
        if (start < today) throw new ArgumentException("Start date: pick today or a later date.");
        if (start > today.AddDays(rules.MaxStartDaysAhead))
            throw new ArgumentException($"Start date: you can start up to {rules.MaxStartDaysAhead} days from today.");
        var days = SubscriptionService.CycleToDays(plan.BillingCycle);

        // A joining fee is charged once: only to people who have never had a paid-up membership here.
        // (Superseded unpaid checkouts are Cancelled without a CancelledAt, so they don't count.)
        var joined = await db.GymMemberships.AnyAsync(m => m.UserId == me && m.Status != MembershipStatus.Pending
                                                           && !(m.Status == MembershipStatus.Cancelled && m.CancelledAt == null));
        var joiningFee = joined ? 0 : plan.JoiningFee;

        Coupon? coupon = null;
        string? couponMessage = null;
        var code = CouponRules.NormalizeCode(r.CouponCode);
        if (code.Length > 0)
        {
            var found = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.TenantId == tenantId && c.Code == code);
            var problem = found is null ? "Coupon code is invalid" : CouponRules.Check(found, plan.Price, DateTime.UtcNow, plan.Currency);
            if (problem is null && found!.PerUserLimit > 0
                && await db.CouponRedemptions.CountAsync(x => x.CouponId == found.Id && x.UserId == me) >= found.PerUserLimit)
                problem = "You've already used this coupon";
            if (problem is null) coupon = found;
            else couponMessage = problem;
        }

        var t = MembershipMath.Join(plan.Price, joiningFee, rules.TaxPercent, coupon);
        if (coupon is not null) couponMessage = $"{coupon.Code} applied: {SelfServiceCommon.Money(t.Discount, plan.Currency)} off";

        var lines = new List<QuoteLine> { new() { Label = $"{plan.Name} ({CycleLabel(plan.BillingCycle)})", Amount = t.PlanPrice, Kind = "plan" } };
        if (t.JoiningFee > 0) lines.Add(new QuoteLine { Label = "Joining fee (one-off)", Amount = t.JoiningFee, Kind = "joining_fee" });
        if (t.Discount > 0) lines.Add(new QuoteLine { Label = $"Coupon {coupon!.Code}", Amount = -t.Discount, Kind = "discount" });
        if (t.Tax > 0) lines.Add(new QuoteLine { Label = $"Tax ({rules.TaxPercent:0.##}%)", Amount = t.Tax, Kind = "tax" });

        var compliance = await safety.EvaluateAsync(me);
        var missing = new List<string>();
        if (!compliance.WaiverOk) missing.Add("waiver");
        if (!compliance.Health.Ok) missing.Add("health");

        var quote = new JoinQuoteResponse
        {
            PlanId = plan.Id, PlanName = plan.Name, BillingCycle = plan.BillingCycle.ToString(), DurationDays = days,
            StartDate = start, EndDate = start.AddDays(days), Currency = plan.Currency, Lines = lines,
            PlanPrice = t.PlanPrice, JoiningFee = t.JoiningFee, Subtotal = t.Subtotal,
            CouponCode = code.Length > 0 ? code : null, CouponApplied = coupon is not null, CouponMessage = couponMessage,
            Discount = t.Discount, TaxPercent = rules.TaxPercent, Tax = t.Tax, Total = t.Total,
            RenewalPrice = Money.Round(plan.Price + Money.Round(plan.Price * rules.TaxPercent / 100m)),
            OnlinePayments = await payments.ActiveGatewayAsync(tenantId) is not null,
            SafetyMissing = missing, SafetyRequired = compliance.GatingEnabled && !compliance.CanBook,
            Rules = MemberRulesResponse.From(rules),
        };
        return new Priced(quote, plan, coupon, rules);
    }

    // ── Checkout ────────────────────────────────────────────────────────────

    public async Task<CheckoutResponse> CheckoutAsync(CheckoutRequest r, string? ip)
    {
        var tenantId = TenantId;
        var me = Me;
        var rules = await MembershipRulesStore.LoadAsync(db, tenantId);
        if (!rules.AllowOnlineJoin)
            throw RuleException.Unprocessable("Joining online isn't available at this gym. Please visit the front desk.");
        if (!r.AcceptTerms)
            throw new ArgumentException("Please read and accept the membership terms to continue.");
        if (await SelfServiceCommon.LiveMembershipAsync(db, me) is { } live
            && (live.EndsAt is null || live.EndsAt >= (await TenantClock.ForAsync(db, tenantId)).Today))
            throw RuleException.Conflict($"You already have a {live.Plan?.Name ?? "current"} membership. Use \"Change plan\" in My membership instead.");

        // The gym's safety gate (when switched on) also guards buying: waiver + health check first.
        await safety.EnsureClearedAsync(me, "join");

        var priced = await PriceAsync(r);
        var quote = priced.Quote;
        if (!string.IsNullOrWhiteSpace(r.CouponCode) && !quote.CouponApplied)
            throw RuleException.Unprocessable(quote.CouponMessage ?? "Coupon code is invalid");

        // The terms checkbox is a consent record (append-only, versioned).
        await consents.RecordMineAsync(new RecordConsentRequest
        {
            Type = ConsentTypes.Terms, Granted = true, Version = string.IsNullOrWhiteSpace(r.TermsVersion) ? TermsVersion : r.TermsVersion, Source = "app",
        }, ip);

        var reused = false;
        var (membership, invoice) = await db.InTransactionAsync(async () =>
        {
            // One checkout at a time per member: a double-tap waits here and then finds the first one.
            await db.LockRowAsync<Domain.Entities.Identity.User>(me);

            var pending = await db.GymMemberships
                .Where(m => m.UserId == me && m.Status == MembershipStatus.Pending && m.Source == MembershipSource.Online)
                .OrderByDescending(m => m.CreatedAt).ToListAsync();
            foreach (var old in pending)
            {
                var oldInvoice = await db.Invoices.FirstOrDefaultAsync(i => i.MembershipId == old.Id && i.Status != InvoiceStatus.Void);
                if (!reused && old.PlanId == quote.PlanId && old.StartsAt == quote.StartDate && oldInvoice is not null
                    && oldInvoice.Total == quote.Total && oldInvoice.AmountPaid == 0)
                {
                    reused = true;
                    return (old, oldInvoice);
                }
                // A different plan / date / price: the earlier unpaid checkout is superseded.
                if (oldInvoice is { AmountPaid: > 0 })
                    throw RuleException.Conflict($"Invoice {oldInvoice.InvoiceNo} for your earlier checkout is part-paid. Please ask the front desk to finish it.");
                await SupersedeAsync(old, oldInvoice);
            }

            var plan = priced.Plan;
            var branch = plan.BranchId ?? await db.Users.Where(u => u.Id == me).Select(u => u.BranchId).FirstOrDefaultAsync();
            var m = new GymMembership
            {
                TenantId = tenantId, UserId = me, PlanId = plan.Id, BranchId = branch,
                Status = MembershipStatus.Pending, StartsAt = quote.StartDate, EndsAt = quote.EndDate,
                AutoRenew = true, Source = MembershipSource.Online,
                Notes = $"Joined online{(quote.CouponApplied ? $" with coupon {quote.CouponCode}" : "")}.",
            };
            db.GymMemberships.Add(m);
            await db.SaveChangesAsync(); // membership id for the invoice

            var items = new List<InvoiceLineItem>
            {
                new() { Description = $"{plan.Name} membership ({quote.StartDate:dd MMM yyyy} – {quote.EndDate.AddDays(-1):dd MMM yyyy})", UnitPrice = plan.Price, Quantity = 1 },
            };
            if (quote.JoiningFee > 0) items.Add(new InvoiceLineItem { Description = "Joining fee", UnitPrice = quote.JoiningFee, Quantity = 1 });
            var inv = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(tenantId, me, items, quote.TaxPercent, quote.Discount,
                DueDate: quote.StartDate, Notes: quote.CouponApplied ? $"Coupon {quote.CouponCode}" : "Online membership", MembershipId: m.Id));
            await db.SaveChangesAsync();

            if (priced.Coupon is { } coupon && quote.Discount > 0)
            {
                // Reserve one use (guarded so two checkouts can't overshoot MaxUses).
                var took = await db.Coupons
                    .Where(c => c.Id == coupon.Id && c.TenantId == tenantId && c.IsActive && (c.MaxUses == null || c.UsesCount < c.MaxUses))
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsesCount, c => c.UsesCount + 1u));
                if (took == 0) throw RuleException.Conflict("This coupon has just reached its usage limit.");
                db.CouponRedemptions.Add(new CouponRedemption
                {
                    TenantId = tenantId, CouponId = coupon.Id, UserId = me, InvoiceId = inv.Id, DiscountApplied = quote.Discount, RedeemedAt = DateTime.UtcNow,
                });
            }

            // Nothing to pay (100% coupon, free plan): live right away.
            if (inv.Status == InvoiceStatus.Paid) await billing.ActivatePaidMembershipAsync(inv);
            await db.SaveChangesAsync();
            return (m, inv);
        });

        var online = await payments.ActiveGatewayAsync(tenantId) is not null;
        var activated = membership.Status == MembershipStatus.Active;
        OnlineOrderResponse? order = null;
        var payAtDesk = false;
        if (!activated && invoice.BalanceDue() > 0)
        {
            if (online)
            {
                await db.Entry(invoice).Reference(i => i.User).LoadAsync();
                await db.Entry(invoice).Reference(i => i.Tenant).LoadAsync();
                order = await payments.CreateOrderAsync(invoice);
            }
            else
            {
                payAtDesk = true;
                if (!reused)
                {
                    var who = SelfServiceCommon.Name(await db.Users.FirstOrDefaultAsync(u => u.Id == me));
                    foreach (var staff in await SelfServiceCommon.StaffRecipientsAsync(db, tenantId))
                        notifier.Add(tenantId, staff, "New member to collect payment",
                            $"{who} chose {quote.PlanName} in the app and will pay {SelfServiceCommon.Money(invoice.Total, invoice.Currency)} at the front desk (invoice {invoice.InvoiceNo}).",
                            "billing", invoice.Id, category: "billing");
                    await db.SaveChangesAsync();
                }
            }
        }

        await db.Entry(membership).Reference(m => m.Plan).LoadAsync();
        await db.Entry(membership).Reference(m => m.User).LoadAsync();
        await db.Entry(invoice).Reference(i => i.User).LoadAsync();
        var sub = SubscriptionService.Map(membership);
        sub.InvoiceId = invoice.Id;
        return new CheckoutResponse
        {
            Membership = sub, Invoice = InvoiceService.Map(invoice), Quote = quote, Order = order,
            PayAtDesk = payAtDesk, Activated = activated, Reused = reused,
        };
    }

    /// <summary>An unpaid earlier checkout the member replaced: void its invoice, give the coupon use back.</summary>
    private async Task SupersedeAsync(GymMembership old, Invoice? oldInvoice)
    {
        old.Status = MembershipStatus.Cancelled;
        old.AutoRenew = false;
        old.Notes = $"{old.Notes}\n[{DateTime.UtcNow:yyyy-MM-dd}] Replaced by a newer online checkout before payment.".Trim();
        old.UpdatedAt = DateTime.UtcNow;
        if (oldInvoice is null) return;
        oldInvoice.Status = InvoiceStatus.Void;
        oldInvoice.UpdatedAt = DateTime.UtcNow;
        var redemptions = await db.CouponRedemptions.Where(x => x.InvoiceId == oldInvoice.Id).ToListAsync();
        foreach (var red in redemptions)
        {
            await db.Coupons.Where(c => c.Id == red.CouponId && c.UsesCount > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsesCount, c => c.UsesCount - 1u));
            db.CouponRedemptions.Remove(red);
        }
    }

    public static string CycleLabel(BillingCycle c) => c switch
    {
        BillingCycle.Daily => "1 day", BillingCycle.Weekly => "1 week", BillingCycle.Monthly => "1 month",
        BillingCycle.Quarterly => "3 months", BillingCycle.HalfYearly => "6 months", BillingCycle.Yearly => "1 year",
        _ => "one-time",
    };
}
