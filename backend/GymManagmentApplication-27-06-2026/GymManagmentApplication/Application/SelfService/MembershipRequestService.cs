using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using T = GymManagmentApplication.Domain.Entities.Membership.MembershipRequestTypes;
using S = GymManagmentApplication.Domain.Entities.Membership.MembershipRequestStatuses;

namespace GymManagmentApplication.Application.SelfService;

/// <summary>
/// Member self-service, part 2: pause (freeze), cancel and change-plan requests.
/// <list type="bullet">
/// <item>The member previews a request (dates, fees, end date in plain language), then submits it.
/// Rules (membership-rules) are checked here, never in the app.</item>
/// <item>Within the rules a request is approved at once when the gym's setting for that type is
/// "auto"; otherwise it waits in the staff queue. The member can withdraw a pending request.</item>
/// <item>Approving carries it out through the existing <see cref="SubscriptionService"/> (Freeze /
/// Unfreeze / Cancel / Upgrade / Downgrade) and <see cref="BillingCore"/> (fee invoices) — right
/// away when due, otherwise on its date via <see cref="ApplyDueAsync"/> (MembershipRequestJob).</item>
/// </list>
/// </summary>
public class MembershipRequestService(
    IAppDbContext db,
    ICurrentUser currentUser,
    BillingCore billing,
    SubscriptionService subscriptions,
    PaymentService payments,
    Notifier notifier)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    // ═════════════════════════════ Member ═════════════════════════════

    public async Task<MyMembershipResponse> GetMyMembershipAsync()
    {
        var tenantId = TenantId;
        var me = Me;
        var rules = await MembershipRulesStore.LoadAsync(db, tenantId);
        var today = await TodayAsync(tenantId);
        var live = await SelfServiceCommon.LiveMembershipAsync(db, me);
        var pending = live is null
            ? await db.GymMemberships.Include(m => m.Plan).Include(m => m.User)
                .Where(m => m.UserId == me && m.Status == MembershipStatus.Pending).OrderByDescending(m => m.CreatedAt).FirstOrDefaultAsync()
            : null;
        var current = live ?? pending;

        var used = await FreezeDaysUsedAsync(me, today.Year, null);
        var open = await db.MembershipRequests
            .Where(r => r.UserId == me && (r.Status == S.Pending || (r.Status == S.Approved && (r.AppliedAt == null || (r.Type == T.Freeze && r.CompletedAt == null)))))
            .OrderByDescending(r => r.RequestedAt).ToListAsync();

        var response = new MyMembershipResponse
        {
            Rules = MemberRulesResponse.From(rules),
            FreezeDaysUsedThisYear = used,
            FreezeDaysLeftThisYear = Math.Max(0, rules.MaxFreezeDaysPerYear - used),
            OpenRequests = await MapManyAsync(open),
            OnlinePayments = await payments.ActiveGatewayAsync(tenantId) is not null,
        };
        if (current is null) return response;

        response.Current = SubscriptionService.Map(current);
        if (current.Plan is not null) response.Plan = SelfServiceCommon.MapPlan(current.Plan);
        if (current.Status == MembershipStatus.Pending)
        {
            var inv = await db.Invoices.Include(i => i.User)
                .FirstOrDefaultAsync(i => i.MembershipId == current.Id && i.Status != InvoiceStatus.Void && i.Total > i.AmountPaid);
            if (inv is not null) response.PendingInvoice = InvoiceService.Map(inv);
            return response;
        }

        var active = current.Status is MembershipStatus.Active or MembershipStatus.Trial;
        var hasOpen = (string type) => open.Any(r => r.MembershipId == current.Id && r.Type == type);
        response.CanFreeze = active && rules.MaxFreezeDaysPerYear > 0 && response.FreezeDaysLeftThisYear >= rules.MinFreezeDays && !hasOpen(T.Freeze);
        response.CanCancel = rules.AllowSelfCancel && !hasOpen(T.Cancel);
        response.CanChangePlan = active && !hasOpen(T.Change) && !hasOpen(T.Cancel);
        var c = CancelPlanFor(current, rules, today);
        response.CancelPreview = MapCancel(c, current.Plan?.Currency ?? "INR");
        return response;
    }

    public async Task<List<MembershipRequestResponse>> GetMineAsync()
    {
        var rows = await db.MembershipRequests.Where(r => r.UserId == Me).OrderByDescending(r => r.RequestedAt).Take(50).ToListAsync();
        return await MapManyAsync(rows);
    }

    public async Task<MembershipRequestResponse> GetMineAsync(ulong id)
    {
        var row = await db.MembershipRequests.FirstOrDefaultAsync(r => r.Id == id && r.UserId == Me)
                  ?? throw new KeyNotFoundException("Request not found.");
        return (await MapManyAsync([row]))[0];
    }

    /// <summary>What the request would do — nothing is saved.</summary>
    public async Task<MembershipRequestPreview> PreviewAsync(CreateMembershipRequestRequest r) => (await EvaluateAsync(r, Me)).Preview;

    public async Task<MembershipRequestResponse> CreateAsync(CreateMembershipRequestRequest r)
    {
        var me = Me;
        var tenantId = TenantId;
        var request = await db.InTransactionAsync(async () =>
        {
            // One submission at a time per member (double-tap safe): the second waits, then sees the first.
            await db.LockRowAsync<Domain.Entities.Identity.User>(me);
            var e = await EvaluateAsync(r, me);
            if (!e.Preview.Allowed) throw RuleException.Unprocessable(e.Preview.Problem ?? "This request isn't allowed.");

            var row = new MembershipRequest
            {
                TenantId = tenantId, UserId = me, MembershipId = e.Membership.Id, Type = e.Preview.Type,
                Status = S.Pending, ReasonCode = Clean(r.ReasonCode, 40), Reason = Clean(r.Reason, 1000),
                RequestedAt = DateTime.UtcNow, EffectiveFrom = e.Preview.EffectiveFrom, EffectiveTo = e.Preview.EffectiveTo,
                NewPlanId = e.Preview.Type == T.Change ? r.NewPlanId : null, Fee = e.Preview.Fee,
            };
            db.MembershipRequests.Add(row);
            await db.SaveChangesAsync();

            if (!e.Preview.NeedsApproval)
                await ApproveCoreAsync(row, deciderId: null, note: null, auto: true);

            var who = SelfServiceCommon.Name(e.Membership.User);
            var what = Describe(row, e.Membership.Plan?.Name, e.Preview.NewPlanName);
            foreach (var staff in await SelfServiceCommon.StaffRecipientsAsync(db, tenantId))
                notifier.Add(tenantId, staff,
                    row.Status == S.Pending ? $"New {TypeLabel(row.Type)} request" : $"{who} {PastTense(row.Type)} (auto-approved)",
                    row.Status == S.Pending ? $"{who} asked to {what}. Review it in Membership requests." : $"{who}: {what}.",
                    "membership_request_staff", row.Id, category: "billing");
            await db.SaveChangesAsync();
            return row;
        });
        return (await MapManyAsync([request]))[0];
    }

    public async Task<MembershipRequestResponse> WithdrawAsync(ulong id)
    {
        var me = Me;
        var row = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<MembershipRequest>(id);
            var x = await db.MembershipRequests.FirstOrDefaultAsync(r => r.Id == id && r.UserId == me)
                    ?? throw new KeyNotFoundException("Request not found.");
            if (x.Status != S.Pending)
                throw RuleException.Conflict(x.Status == S.Withdrawn ? "You've already withdrawn this request." : $"This request was already {x.Status}, so it can't be withdrawn.");
            x.Status = S.Withdrawn;
            x.DecidedAt = DateTime.UtcNow;
            x.DecidedBy = me;
            x.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return x;
        });
        return (await MapManyAsync([row]))[0];
    }

    // ── Evaluation (shared by preview and create) ───────────────────────────

    private sealed record Evaluation(MembershipRequestPreview Preview, GymMembership Membership);

    private async Task<Evaluation> EvaluateAsync(CreateMembershipRequestRequest r, ulong me)
    {
        var tenantId = TenantId;
        var type = (r.Type ?? "").Trim().ToLowerInvariant();
        if (!T.All.Contains(type)) throw new ArgumentException("Type: must be freeze, cancel or change.");

        var membership = r.MembershipId is { } mid
            ? await db.GymMemberships.Include(m => m.Plan).Include(m => m.User).FirstOrDefaultAsync(m => m.Id == mid && m.UserId == me)
            : await SelfServiceCommon.LiveMembershipAsync(db, me);
        if (membership is null) throw new KeyNotFoundException("You don't have a membership to change.");

        var rules = await MembershipRulesStore.LoadAsync(db, tenantId);
        var today = await TodayAsync(tenantId);
        var currency = membership.Plan?.Currency ?? "INR";
        var p = new MembershipRequestPreview { Type = type, Currency = currency, NeedsApproval = !rules.AutoApproves(type) };
        var used = await FreezeDaysUsedAsync(me, today.Year, null);
        p.FreezeDaysLeft = Math.Max(0, rules.MaxFreezeDaysPerYear - used);

        async Task<string?> ProblemAsync()
        {
            var openOfType = await db.MembershipRequests.AnyAsync(x => x.MembershipId == membership.Id && x.Type == type
                && (x.Status == S.Pending || (x.Status == S.Approved && x.AppliedAt == null)));
            return openOfType ? $"You already have an open {TypeLabel(type)} request." : null;
        }

        switch (type)
        {
            case T.Freeze:
            {
                if (membership.Status is not (MembershipStatus.Active or MembershipStatus.Trial))
                    return Deny(p, membership, membership.Status == MembershipStatus.Paused ? "Your membership is already paused." : "Only an active membership can be paused.");
                if (r.From is not { } from || r.To is not { } to) return Deny(p, membership, "Pick the first and last day of your pause.");
                var usedInYear = await FreezeDaysUsedAsync(me, from.Year, null);
                var problem = MembershipMath.FreezeProblem(today, from, to, usedInYear, rules, membership.EndsAt) ?? await ProblemAsync();
                if (problem is null && await OverlapsFreezeAsync(membership.Id, from, to)) problem = "These dates overlap a pause you already have.";
                var days = MembershipMath.FreezeDays(from, to);
                p.EffectiveFrom = from; p.EffectiveTo = to; p.Days = days; p.Fee = rules.FreezeFee;
                if (rules.FreezeFee > 0) p.Lines.Add(new QuoteLine { Label = "Pause fee", Amount = rules.FreezeFee, Kind = "fee" });
                var newEnd = membership.EndsAt?.AddDays(days);
                p.Summary = $"Your membership pauses from {from:ddd d MMM} to {to:ddd d MMM yyyy} ({days} days). "
                            + (newEnd is { } ne ? $"Those days are added back, so it will end on {ne:d MMM yyyy} instead of {membership.EndsAt:d MMM yyyy}. " : "")
                            + (rules.FreezeFee > 0 ? $"A pause fee of {SelfServiceCommon.Money(rules.FreezeFee, currency)} applies. " : "No fee. ")
                            + (p.NeedsApproval ? "The gym will confirm it." : "It's confirmed straight away.");
                return problem is null ? Allow(p, membership) : Deny(p, membership, problem);
            }
            case T.Cancel:
            {
                if (!rules.AllowSelfCancel) return Deny(p, membership, "Please speak to the front desk to cancel your membership.");
                if (membership.Status is not (MembershipStatus.Active or MembershipStatus.Trial or MembershipStatus.Paused))
                    return Deny(p, membership, "Only a current membership can be cancelled.");
                var c = CancelPlanFor(membership, rules, today);
                p.Cancel = MapCancel(c, currency);
                p.EffectiveFrom = c.LastDay;
                p.Fee = c.FinalCharge;
                if (c.UncoveredCharge > 0)
                    p.Lines.Add(new QuoteLine { Label = $"{c.UncoveredDays} day{(c.UncoveredDays == 1 ? "" : "s")} until your last day", Amount = c.UncoveredCharge, Kind = "charge" });
                if (c.CancellationFee > 0) p.Lines.Add(new QuoteLine { Label = "Cancellation fee", Amount = c.CancellationFee, Kind = "fee" });
                var why = c.MinimumTermEnd is { } te && te == c.LastDay ? $" (your {rules.MinimumTermMonths}-month minimum term)"
                    : c.NoticeEnd is { } ne && ne == c.LastDay ? $" ({rules.NoticeDays} days' notice)"
                    : c.PaidThrough is { } pt && pt == c.LastDay ? " (the end of the period you've paid for)" : "";
                p.Summary = $"You can keep training until {c.LastDay:ddd d MMM yyyy}{why}. Your membership won't renew after that. "
                            + (c.FinalCharge > 0 ? $"A final invoice of {SelfServiceCommon.Money(c.FinalCharge, currency)} will be raised. " : "There's nothing more to pay. ")
                            + (p.NeedsApproval ? "The gym will review your request." : "");
                p.CanPauseInstead = membership.Status != MembershipStatus.Paused && rules.MaxFreezeDaysPerYear > 0 && p.FreezeDaysLeft >= rules.MinFreezeDays;
                var problem = await ProblemAsync();
                return problem is null ? Allow(p, membership) : Deny(p, membership, problem);
            }
            default: // change
            {
                if (membership.Status is not (MembershipStatus.Active or MembershipStatus.Trial))
                    return Deny(p, membership, "You can change plan while your membership is active.");
                if (r.NewPlanId is not { } newPlanId || newPlanId == membership.PlanId) return Deny(p, membership, "Pick a different plan.");
                var plan = await db.MembershipPlans.FirstOrDefaultAsync(x => x.Id == newPlanId && x.TenantId == membership.TenantId && x.IsActive && x.IsPublic);
                if (plan is null) return Deny(p, membership, "That plan isn't available.");
                p.NewPlanName = plan.Name;
                var oldDays = SubscriptionService.CycleToDays(membership.Plan?.BillingCycle);
                var newDays = SubscriptionService.CycleToDays(plan.BillingCycle);
                var oldPrice = membership.Plan?.Price ?? 0;
                if (MembershipMath.IsUpgrade(oldPrice, oldDays, plan.Price, newDays))
                {
                    var (left, charge) = MembershipMath.UpgradeCharge(today, membership.EndsAt, oldPrice, oldDays, plan.Price, newDays);
                    var tax = Money.Round(charge * rules.TaxPercent / 100m);
                    p.ChangeKind = "upgrade";
                    p.EffectiveFrom = today;
                    p.Fee = charge;
                    if (charge > 0) p.Lines.Add(new QuoteLine { Label = $"Upgrade for the {left} day{(left == 1 ? "" : "s")} left this period", Amount = charge, Kind = "charge" });
                    if (tax > 0) p.Lines.Add(new QuoteLine { Label = $"Tax ({rules.TaxPercent:0.##}%)", Amount = tax, Kind = "tax" });
                    p.Summary = $"You move to {plan.Name} today. "
                                + (charge > 0 ? $"You pay {SelfServiceCommon.Money(charge + tax, currency)} now for the rest of this period; " : "")
                                + $"from {membership.EndsAt?.AddDays(1):d MMM yyyy} you pay {SelfServiceCommon.Money(plan.Price, plan.Currency)} per {SelfServicePlansService.CycleLabel(plan.BillingCycle)}.";
                }
                else
                {
                    p.ChangeKind = "downgrade";
                    p.EffectiveFrom = membership.EndsAt ?? today;
                    p.Summary = $"You stay on {membership.Plan?.Name} until {membership.EndsAt:d MMM yyyy}. "
                                + $"From your next renewal you move to {plan.Name} at {SelfServiceCommon.Money(plan.Price, plan.Currency)} per {SelfServicePlansService.CycleLabel(plan.BillingCycle)}. Nothing to pay now.";
                }
                if (p.NeedsApproval) p.Summary += " The gym will confirm it.";
                var problem = await ProblemAsync() ?? (await db.MembershipRequests.AnyAsync(x => x.MembershipId == membership.Id && x.Type == T.Cancel
                    && (x.Status == S.Pending || (x.Status == S.Approved && x.AppliedAt == null))) ? "You have a cancellation in progress." : null);
                return problem is null ? Allow(p, membership) : Deny(p, membership, problem);
            }
        }
    }

    private static Evaluation Allow(MembershipRequestPreview p, GymMembership m) { p.Allowed = true; p.Problem = null; return new Evaluation(p, m); }
    private static Evaluation Deny(MembershipRequestPreview p, GymMembership m, string problem) { p.Allowed = false; p.Problem = problem; return new Evaluation(p, m); }

    private static MembershipMath.CancelPlan CancelPlanFor(GymMembership m, MembershipRulesSettings rules, DateOnly today) =>
        MembershipMath.Cancel(today, m.StartsAt, m.EndsAt, m.Plan?.Price ?? 0, SubscriptionService.CycleToDays(m.Plan?.BillingCycle), rules);

    private static CancelPreview MapCancel(MembershipMath.CancelPlan c, string currency) => new()
    {
        LastDay = c.LastDay, NoticeEnd = c.NoticeEnd, MinimumTermEnd = c.MinimumTermEnd, PaidThrough = c.PaidThrough,
        UncoveredDays = c.UncoveredDays, UncoveredCharge = c.UncoveredCharge, CancellationFee = c.CancellationFee,
        FinalCharge = c.FinalCharge, Currency = currency,
    };

    /// <summary>Pause days of <paramref name="year"/> already taken or booked (approved + pending requests).</summary>
    private async Task<int> FreezeDaysUsedAsync(ulong userId, int year, ulong? excludeId)
    {
        var rows = await db.MembershipRequests
            .Where(x => x.UserId == userId && x.Type == T.Freeze && (x.Status == S.Pending || x.Status == S.Approved)
                        && x.EffectiveFrom != null && x.EffectiveTo != null && (excludeId == null || x.Id != excludeId))
            .Select(x => new { From = x.EffectiveFrom!.Value, To = x.EffectiveTo!.Value }).ToListAsync();
        return MembershipMath.DaysInYear(rows.Select(x => (x.From, x.To)), year);
    }

    private Task<bool> OverlapsFreezeAsync(ulong membershipId, DateOnly from, DateOnly to) =>
        db.MembershipRequests.AnyAsync(x => x.MembershipId == membershipId && x.Type == T.Freeze
            && (x.Status == S.Pending || x.Status == S.Approved) && x.CompletedAt == null
            && x.EffectiveFrom <= to && x.EffectiveTo >= from);

    // ═════════════════════════════ Staff ═════════════════════════════

    public async Task<PagedResponse<MembershipRequestResponse>> ListAsync(string? status, string? type, ulong? memberId, int page, int size)
    {
        (page, size) = Paging.Clamp(page, size);
        var q = db.MembershipRequests.Where(r => r.TenantId == TenantId);
        switch ((status ?? "pending").Trim().ToLowerInvariant())
        {
            case "pending": q = q.Where(r => r.Status == S.Pending); break;
            case "decided": q = q.Where(r => r.Status != S.Pending); break;
            case "all": break;
            case var s when S.All.Contains(s): q = q.Where(r => r.Status == s); break;
            default: throw new ArgumentException("Status: pending, decided, all, approved, rejected or withdrawn.");
        }
        if (!string.IsNullOrWhiteSpace(type))
        {
            var t = type.Trim().ToLowerInvariant();
            if (!T.All.Contains(t)) throw new ArgumentException("Type: freeze, cancel or change.");
            q = q.Where(r => r.Type == t);
        }
        if (memberId is { } mid) q = q.Where(r => r.UserId == mid);
        var total = await q.CountAsync();
        var rows = await q.OrderByDescending(r => r.Status == S.Pending).ThenByDescending(r => r.RequestedAt).Page(page, size).ToListAsync();
        return new PagedResponse<MembershipRequestResponse> { Items = await MapManyAsync(rows), PageNumber = page, PageSize = size, TotalRecords = total };
    }

    public async Task<int> CountPendingAsync() => await db.MembershipRequests.CountAsync(r => r.TenantId == TenantId && r.Status == S.Pending);

    public async Task<MembershipRequestResponse> GetAsync(ulong id)
    {
        var row = await db.MembershipRequests.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == TenantId)
                  ?? throw new KeyNotFoundException("Request not found.");
        return (await MapManyAsync([row]))[0];
    }

    public Task<MembershipRequestResponse> ApproveAsync(ulong id, DecideMembershipRequestRequest r) => DecideAsync(id, r, approve: true);
    public Task<MembershipRequestResponse> RejectAsync(ulong id, DecideMembershipRequestRequest r) => DecideAsync(id, r, approve: false);

    private async Task<MembershipRequestResponse> DecideAsync(ulong id, DecideMembershipRequestRequest r, bool approve)
    {
        var tenantId = TenantId;
        var note = Clean(r.Note, 1000);
        if (!approve && note is null) throw new ArgumentException("Note: tell the member why (they will see it).");
        var row = await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<MembershipRequest>(id);
            var x = await db.MembershipRequests.FirstOrDefaultAsync(q => q.Id == id && q.TenantId == tenantId)
                    ?? throw new KeyNotFoundException("Request not found.");
            if (x.Status != S.Pending) throw RuleException.Conflict($"This request is already {x.Status}.");
            if (approve) await ApproveCoreAsync(x, currentUser.UserId, note, auto: false);
            else
            {
                x.Status = S.Rejected;
                x.DecidedBy = currentUser.UserId;
                x.DecidedAt = DateTime.UtcNow;
                x.DecisionNote = note;
                x.UpdatedAt = DateTime.UtcNow;
                notifier.Add(x.TenantId, x.UserId, $"Your {TypeLabel(x.Type)} request wasn't approved", note,
                    "membership_request", x.Id, category: "billing");
            }
            await db.SaveChangesAsync();
            return x;
        });
        return (await MapManyAsync([row]))[0];
    }

    public Task<MembershipRulesSettings> GetRulesAsync() => MembershipRulesStore.LoadAsync(db, TenantId);
    public Task<MembershipRulesSettings> SaveRulesAsync(MembershipRulesSettings s) => MembershipRulesStore.SaveAsync(db, TenantId, s);

    // ═════════════════════════ Carrying it out ═════════════════════════

    /// <summary>Marks the request approved, raises its fee invoice and applies it if it is due today.</summary>
    private async Task ApproveCoreAsync(MembershipRequest x, ulong? deciderId, string? note, bool auto)
    {
        x.Status = S.Approved;
        x.AutoApproved = auto;
        x.DecidedBy = deciderId;
        x.DecidedAt = DateTime.UtcNow;
        x.DecisionNote = note;
        x.UpdatedAt = DateTime.UtcNow;

        var m = await db.GymMemberships.Include(g => g.Plan).FirstAsync(g => g.Id == x.MembershipId);
        var rules = await MembershipRulesStore.LoadAsync(db, x.TenantId);
        var today = await TodayAsync(x.TenantId);

        if (x.Type == T.Cancel)
        {
            // Recomputed at approval (staff may decide days later): notice runs from the request date.
            var requestedOn = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(x.RequestedAt, (await TenantClock.ForAsync(db, x.TenantId)).Zone));
            var c = CancelPlanFor(m, rules, requestedOn < today ? requestedOn : today);
            x.EffectiveFrom = c.LastDay;
            x.Fee = c.FinalCharge;
            // No renewal after the last day; extend the paid-through date if notice / minimum term runs longer.
            m.AutoRenew = false;
            if (m.EndsAt is { } end && c.LastDay > end) m.EndsAt = c.LastDay;
            m.UpdatedAt = DateTime.UtcNow;
            var items = new List<InvoiceLineItem>();
            if (c.UncoveredCharge > 0)
                items.Add(new InvoiceLineItem { Description = $"{m.Plan?.Name} to {c.LastDay:dd MMM yyyy} ({c.UncoveredDays} days' notice / minimum term)", UnitPrice = c.UncoveredCharge, Quantity = 1 });
            if (c.CancellationFee > 0) items.Add(new InvoiceLineItem { Description = "Cancellation fee", UnitPrice = c.CancellationFee, Quantity = 1 });
            if (items.Count > 0) await RaiseInvoiceAsync(x, items, rules.TaxPercent, "Final invoice on cancellation");
        }
        else if (x.Type == T.Freeze && x.Fee > 0)
        {
            await RaiseInvoiceAsync(x, [new InvoiceLineItem { Description = $"Membership pause {x.EffectiveFrom:dd MMM} – {x.EffectiveTo:dd MMM yyyy}", UnitPrice = x.Fee, Quantity = 1 }],
                rules.TaxPercent, "Pause fee");
        }
        else if (x.Type == T.Change && x.Fee > 0)
        {
            var plan = await db.MembershipPlans.FirstAsync(p => p.Id == x.NewPlanId);
            await RaiseInvoiceAsync(x, [new InvoiceLineItem { Description = $"Upgrade to {plan.Name} (rest of current period)", UnitPrice = x.Fee, Quantity = 1 }],
                rules.TaxPercent, "Plan upgrade");
        }
        await db.SaveChangesAsync();

        await ApplyIfDueAsync(x, today);

        notifier.Add(x.TenantId, x.UserId, $"Your {TypeLabel(x.Type)} request is approved",
            "Approved: " + Describe(x, m.Plan?.Name, x.NewPlanId is { } np ? await db.MembershipPlans.Where(p => p.Id == np).Select(p => p.Name).FirstOrDefaultAsync() : null)
            + "." + (x.InvoiceId is not null ? " An invoice is waiting in your billing." : "") + (note is null ? "" : $" Note from the gym: {note}"),
            "membership_request", x.Id, category: "billing");
    }

    private async Task RaiseInvoiceAsync(MembershipRequest x, List<InvoiceLineItem> items, decimal taxPercent, string notes)
    {
        var today = await TodayAsync(x.TenantId);
        var inv = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(x.TenantId, x.UserId, items, taxPercent,
            DueDate: today, Notes: notes, MembershipId: x.MembershipId));
        await db.SaveChangesAsync();
        x.InvoiceId = inv.Id;
    }

    /// <summary>
    /// Carries out an approved request when its date has come, through SubscriptionService:
    /// freeze → FreezeAsync on the first day, UnfreezeAsync after the last; cancel → CancelAsync after
    /// the last day; change → UpgradeAsync (now) / DowngradeAsync (on the renewal date). Idempotent.
    /// </summary>
    private async Task ApplyIfDueAsync(MembershipRequest x, DateOnly today)
    {
        if (x.Status != S.Approved) return;
        switch (x.Type)
        {
            case T.Freeze:
                if (x.AppliedAt is null && x.EffectiveFrom <= today)
                {
                    await subscriptions.FreezeAsync(x.MembershipId, new FreezeSubscriptionRequest
                    {
                        FreezeFrom = x.EffectiveFrom!.Value, FreezeUntil = x.EffectiveTo!.Value, Reason = x.Reason ?? "Member request",
                    });
                    x.AppliedAt = DateTime.UtcNow;
                }
                if (x.AppliedAt is not null && x.CompletedAt is null && x.EffectiveTo < today)
                {
                    var m = await db.GymMemberships.AsNoTracking().FirstAsync(g => g.Id == x.MembershipId);
                    if (m.Status == MembershipStatus.Paused) await subscriptions.UnfreezeAsync(x.MembershipId);
                    x.CompletedAt = DateTime.UtcNow;
                }
                break;
            case T.Cancel:
                if (x.AppliedAt is null && x.EffectiveFrom < today)
                {
                    var m = await db.GymMemberships.AsNoTracking().FirstAsync(g => g.Id == x.MembershipId);
                    if (m.Status == MembershipStatus.Paused) await subscriptions.UnfreezeAsync(x.MembershipId);
                    await subscriptions.CancelAsync(x.MembershipId);
                    x.AppliedAt = DateTime.UtcNow;
                }
                break;
            case T.Change:
                if (x.AppliedAt is null && x.EffectiveFrom <= today && x.NewPlanId is { } planId)
                {
                    var change = new UpgradeDowngradeRequest { NewPlanId = planId, EffectiveDate = x.EffectiveFrom };
                    if (x.Fee > 0) await subscriptions.UpgradeAsync(x.MembershipId, change);
                    else await subscriptions.DowngradeAsync(x.MembershipId, change);
                    x.AppliedAt = DateTime.UtcNow;
                }
                break;
        }
        x.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    /// <summary>For the background job: applies every approved request of the gym that has come due.</summary>
    public async Task<int> ApplyDueAsync(ulong tenantId, DateOnly today, CancellationToken ct = default)
    {
        var due = await db.MembershipRequests.IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && x.Status == S.Approved
                        && ((x.AppliedAt == null && x.EffectiveFrom <= today) || (x.Type == T.Freeze && x.AppliedAt != null && x.CompletedAt == null && x.EffectiveTo < today)))
            .OrderBy(x => x.EffectiveFrom).ToListAsync(ct);
        var n = 0;
        foreach (var x in due)
        {
            try
            {
                await ApplyIfDueAsync(x, today);
                n++;
            }
            catch (ArgumentException ex)
            {
                // E.g. the membership was cancelled at the desk meanwhile: nothing left to do.
                x.AppliedAt ??= DateTime.UtcNow;
                if (x.Type == T.Freeze) x.CompletedAt ??= DateTime.UtcNow;
                x.DecisionNote = $"{x.DecisionNote} [Not applied: {ex.Message}]".Trim();
                await db.SaveChangesAsync(ct);
            }
        }
        return n;
    }

    // ═════════════════════════════ Mapping ═════════════════════════════

    private async Task<List<MembershipRequestResponse>> MapManyAsync(IReadOnlyCollection<MembershipRequest> rows)
    {
        if (rows.Count == 0) return [];
        var membershipIds = rows.Select(r => r.MembershipId).Distinct().ToList();
        var memberships = await db.GymMemberships.IgnoreQueryFilters().Include(m => m.Plan)
            .Where(m => membershipIds.Contains(m.Id)).ToDictionaryAsync(m => m.Id);
        var userIds = rows.Select(r => r.UserId).Concat(rows.Where(r => r.DecidedBy != null).Select(r => r.DecidedBy!.Value)).Distinct().ToList();
        var names = await db.Users.IgnoreQueryFilters().Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() }).ToDictionaryAsync(u => u.Id, u => u.Name);
        var planIds = rows.Where(r => r.NewPlanId != null).Select(r => r.NewPlanId!.Value).Distinct().ToList();
        var plans = planIds.Count == 0 ? [] : await db.MembershipPlans.IgnoreQueryFilters().Where(p => planIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);
        return rows.Select(r =>
        {
            var m = memberships.GetValueOrDefault(r.MembershipId);
            return new MembershipRequestResponse
            {
                Id = r.Id, MembershipId = r.MembershipId, MemberId = r.UserId, MemberName = names.GetValueOrDefault(r.UserId),
                PlanName = m?.Plan?.Name, Type = r.Type, Status = r.Status, ReasonCode = r.ReasonCode, Reason = r.Reason,
                RequestedAt = r.RequestedAt, EffectiveFrom = r.EffectiveFrom, EffectiveTo = r.EffectiveTo,
                NewPlanId = r.NewPlanId, NewPlanName = r.NewPlanId is { } np ? plans.GetValueOrDefault(np) : null,
                Fee = r.Fee, Currency = m?.Plan?.Currency ?? "INR", InvoiceId = r.InvoiceId, AutoApproved = r.AutoApproved,
                DecidedBy = r.DecidedBy, DecidedByName = r.DecidedBy is { } d ? names.GetValueOrDefault(d) : null,
                DecidedAt = r.DecidedAt, DecisionNote = r.DecisionNote, AppliedAt = r.AppliedAt, CompletedAt = r.CompletedAt,
                MembershipStatus = m?.Status.ToString(),
            };
        }).ToList();
    }

    private async Task<DateOnly> TodayAsync(ulong tenantId) => (await TenantClock.ForAsync(db, tenantId)).Today;

    private static string? Clean(string? s, int max)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        s = s.Trim();
        return s.Length > max ? s[..max] : s;
    }

    public static string TypeLabel(string type) => type switch { T.Freeze => "pause", T.Cancel => "cancellation", _ => "plan change" };

    private static string PastTense(string type) => type switch { T.Freeze => "paused their membership", T.Cancel => "cancelled", _ => "changed plan" };

    private static string Describe(MembershipRequest x, string? planName, string? newPlanName) => x.Type switch
    {
        T.Freeze => $"pause {planName ?? "the membership"} from {x.EffectiveFrom:d MMM} to {x.EffectiveTo:d MMM yyyy}",
        T.Cancel => $"cancel {planName ?? "the membership"} — last day {x.EffectiveFrom:d MMM yyyy}",
        _ => $"change from {planName} to {newPlanName ?? "another plan"} on {x.EffectiveFrom:d MMM yyyy}",
    };
}
