using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Billing.Payments;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Application.SelfService;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>Member self-service (roadmap feature 4): plans, join/checkout, pause/cancel/change requests.</summary>
public class SelfServiceTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly FakeRazorpay _rzp = new();
    private readonly PlainSecrets _secrets = new();
    private readonly NullOutbox _outbox = new();

    private const ulong Admin = 1, Member = 100, OtherGymAdmin = 2, OtherGymMember = 200;
    private const string KeySecret = "rzp_test_secret", WebhookSecret = "whsec_test";
    private ulong _basic, _premium, _hidden, _otherGymPlan;

    public SelfServiceTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        using (var seed = _db.Create(null))
        {
            seed.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 22, TenantId = 2, Name = "Admin", Slug = "admin" });
            seed.SaveChanges();
            seed.Users.AddRange(
                new User { Id = Admin, TenantId = 1, RoleId = 12, Uuid = Guid.NewGuid().ToString(), Email = "a1@test.local", FirstName = "Ada", LastName = "Admin", Status = UserStatus.Active },
                new User { Id = OtherGymAdmin, TenantId = 2, RoleId = 22, Uuid = Guid.NewGuid().ToString(), Email = "a2@test.local", FirstName = "Bo", LastName = "Admin", Status = UserStatus.Active });
            seed.SaveChanges();
        }
        _db.AddMember(Member, tenantId: 1);
        _db.AddMember(OtherGymMember, tenantId: 2);

        using var db = _db.Create(null);
        var basic = new MembershipPlan { TenantId = 1, Name = "Basic", Price = 1000, Currency = "INR", BillingCycle = BillingCycle.Monthly, JoiningFee = 500, IsPublic = true, IsPopular = true, ClassCredits = 8 };
        var premium = new MembershipPlan { TenantId = 1, Name = "Premium", Price = 3000, Currency = "INR", BillingCycle = BillingCycle.Monthly, IsPublic = true };
        var hidden = new MembershipPlan { TenantId = 1, Name = "Staff only", Price = 10, Currency = "INR", BillingCycle = BillingCycle.Monthly, IsPublic = false };
        var other = new MembershipPlan { TenantId = 2, Name = "Gym 2 plan", Price = 700, Currency = "INR", BillingCycle = BillingCycle.Monthly, IsPublic = true };
        db.MembershipPlans.AddRange(basic, premium, hidden, other);
        db.Coupons.Add(new Coupon { TenantId = 1, Code = "SAVE10", Type = CouponType.Percentage, Value = 10, IsActive = true, PerUserLimit = 1 });
        db.SaveChanges();
        (_basic, _premium, _hidden, _otherGymPlan) = (basic.Id, premium.Id, hidden.Id, other.Id);
    }

    public void Dispose() => _db.Dispose();

    // ── Plumbing ────────────────────────────────────────────────────────────

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsAdmin(ulong id = Admin, ulong tenant = 1) => new() { UserId = id, Role = "admin", TenantId = tenant };
    private static readonly FakeUser System = new() { IsAuthenticated = false, UserId = null, TenantId = null, Role = "" };

    private sealed record Svc(AppDbContext Db, SelfServicePlansService Plans, MembershipRequestService Requests, PaymentService Payments) : IDisposable
    {
        public void Dispose() => Db.Dispose();
    }

    private Svc Services(FakeUser me)
    {
        var db = _db.Create(me);
        var notifier = new Notifier(db, me);
        var billing = new BillingCore(db, notifier);
        var payments = new PaymentService(db, me, billing, _rzp, _secrets, _outbox, NullLogger<PaymentService>.Instance);
        var plans = new SelfServicePlansService(db, me, billing, payments, new SafetyGate(db, me), new ConsentService(db, me), notifier);
        var requests = new MembershipRequestService(db, me, billing, new SubscriptionService(db, me, billing), payments, notifier);
        return new Svc(db, plans, requests, payments);
    }

    private static DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TenantClock.Resolve("Asia/Kolkata")));

    private async Task SetRulesAsync(Action<MembershipRulesSettings> change, ulong tenant = 1)
    {
        using var db = _db.Create(AsAdmin(tenant == 1 ? Admin : OtherGymAdmin, tenant));
        var rules = await MembershipRulesStore.LoadAsync(db, tenant);
        change(rules);
        await MembershipRulesStore.SaveAsync(db, tenant, rules);
    }

    private void EnableGateway(ulong tenant = 1)
    {
        using var db = _db.Create(null);
        db.Set<PaymentGateway>().Add(new PaymentGateway
        {
            TenantId = tenant, Provider = "razorpay", IsActive = true, IsDefault = true,
            ConfigEnc = JsonSerializer.SerializeToDocument(new { keyId = "rzp_test_key", keySecret = KeySecret, webhookSecret = WebhookSecret }),
        });
        db.SaveChanges();
    }

    private static string Hmac(string secret, string data) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(data))).ToLowerInvariant();

    private async Task<CheckoutResponse> CheckoutAsync(ulong planId, string? coupon = null, DateOnly? start = null)
    {
        using var s = Services(AsMember());
        return await s.Plans.CheckoutAsync(new CheckoutRequest { PlanId = planId, CouponCode = coupon, StartDate = start, AcceptTerms = true }, "127.0.0.1");
    }

    private GymMembership MembershipOf(ulong id)
    {
        using var db = _db.Create(null);
        return db.GymMemberships.AsNoTracking().Single(m => m.Id == id);
    }

    /// <summary>Gives the member an active Basic membership from <paramref name="start"/> for 30 days.</summary>
    private ulong GiveActiveMembership(DateOnly? start = null, ulong planId = 0)
    {
        using var db = _db.Create(null);
        var s = start ?? Today.AddDays(-5);
        var m = new GymMembership
        {
            TenantId = 1, UserId = Member, PlanId = planId == 0 ? _basic : planId, Status = MembershipStatus.Active,
            StartsAt = s, EndsAt = s.AddDays(30), AutoRenew = true, Source = MembershipSource.Admin,
        };
        db.GymMemberships.Add(m);
        db.SaveChanges();
        return m.Id;
    }

    private int NotificationsFor(ulong userId)
    {
        using var db = _db.Create(null);
        return db.Set<Notification>().Count(n => n.UserId == userId);
    }

    // ── Plans ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Plan_browser_lists_only_public_active_plans_of_the_members_gym()
    {
        using var s = Services(AsMember());
        var catalog = await s.Plans.GetCatalogAsync();
        Assert.Equal(["Basic", "Premium"], catalog.Plans.Select(p => p.Name).OrderBy(n => n).ToArray());
        var basic = catalog.Plans.Single(p => p.Name == "Basic");
        Assert.True(basic.IsPopular);
        Assert.Equal(500m, basic.JoiningFee);
        Assert.Equal(8, basic.ClassCredits);
        Assert.False(catalog.OnlinePayments);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _hidden }));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _otherGymPlan }));
    }

    // ── Quote ───────────────────────────────────────────────────────────────

    [Fact]
    public void Join_math_discounts_the_plan_only_then_taxes_the_rest()
    {
        var coupon = new Coupon { Code = "SAVE10", Type = CouponType.Percentage, Value = 10, IsActive = true };
        var t = MembershipMath.Join(1000, 500, 18, coupon);
        Assert.Equal(1500m, t.Subtotal);
        Assert.Equal(100m, t.Discount);   // 10% of the plan, not the joining fee
        Assert.Equal(252m, t.Tax);        // 18% of 1400
        Assert.Equal(1652m, t.Total);
    }

    [Fact]
    public async Task Quote_totals_include_joining_fee_coupon_and_gym_tax()
    {
        await SetRulesAsync(r => r.TaxPercent = 18);
        using var s = Services(AsMember());
        var q = await s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic, CouponCode = "save10" });

        Assert.True(q.CouponApplied);
        Assert.Equal("SAVE10", q.CouponCode);
        Assert.Equal(1000m, q.PlanPrice);
        Assert.Equal(500m, q.JoiningFee);
        Assert.Equal(100m, q.Discount);
        Assert.Equal(252m, q.Tax);
        Assert.Equal(1652m, q.Total);
        Assert.Equal(1180m, q.RenewalPrice);
        Assert.Equal(Today, q.StartDate);
        Assert.Equal(Today.AddDays(30), q.EndDate);
        Assert.Contains(q.Lines, l => l.Kind == "joining_fee" && l.Amount == 500);
        Assert.Contains(q.Lines, l => l.Kind == "discount" && l.Amount == -100);
        Assert.Contains("health", q.SafetyMissing);

        var bad = await s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic, CouponCode = "NOPE" });
        Assert.False(bad.CouponApplied);
        Assert.Equal("Coupon code is invalid", bad.CouponMessage);
        Assert.Equal(1770m, bad.Total);

        await Assert.ThrowsAsync<ArgumentException>(() => s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic, StartDate = Today.AddDays(-1) }));
        await Assert.ThrowsAsync<ArgumentException>(() => s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic, StartDate = Today.AddDays(61) }));
    }

    [Fact]
    public async Task Checkout_invoice_matches_the_quote_and_records_terms_consent_and_coupon_use()
    {
        await SetRulesAsync(r => r.TaxPercent = 18);
        EnableGateway();
        var res = await CheckoutAsync(_basic, "SAVE10");

        Assert.Equal(1652m, res.Invoice.Total);
        Assert.Equal(252m, res.Invoice.Tax);
        Assert.NotNull(res.Order);
        Assert.Equal(165200, res.Order!.AmountMinor);
        Assert.False(res.PayAtDesk);

        using var db = _db.Create(null);
        Assert.True(db.ConsentRecords.Any(c => c.UserId == Member && c.Type == "terms" && c.Granted));
        Assert.Equal(1u, db.Coupons.Single(c => c.Code == "SAVE10").UsesCount);
        Assert.Single(db.CouponRedemptions.Where(r => r.UserId == Member));

        using var s = Services(AsMember());
        await Assert.ThrowsAsync<ArgumentException>(() =>
            s.Plans.CheckoutAsync(new CheckoutRequest { PlanId = _basic, AcceptTerms = false }, null));
    }

    // ── Activation ──────────────────────────────────────────────────────────

    [Fact]
    public async Task Membership_is_activated_only_after_a_verified_payment_and_only_once()
    {
        EnableGateway();
        var res = await CheckoutAsync(_basic);
        Assert.Equal("Pending", res.Membership.Status);
        Assert.Equal(MembershipStatus.Pending, MembershipOf(res.Membership.Id).Status);
        using (var db = _db.Create(null))
            Assert.Contains("paid", await MembershipRules.BlockReasonAsync(db, Member));

        var order = res.Order!;
        _rzp.Payments["pay_1"] = new RazorpayPaymentInfo("pay_1", "captured", "upi", order.AmountMinor, order.OrderId);

        // A forged signature changes nothing.
        using (var s = Services(AsMember()))
            await Assert.ThrowsAsync<ArgumentException>(() => s.Payments.VerifyOnlineAsync(new VerifyOnlinePaymentRequest
                { InvoiceId = order.InvoiceId, OrderId = order.OrderId, PaymentId = "pay_1", Signature = "forged" }));
        Assert.Equal(MembershipStatus.Pending, MembershipOf(res.Membership.Id).Status);

        var verify = new VerifyOnlinePaymentRequest
            { InvoiceId = order.InvoiceId, OrderId = order.OrderId, PaymentId = "pay_1", Signature = Hmac(KeySecret, $"{order.OrderId}|pay_1") };
        using (var s = Services(AsMember())) await s.Payments.VerifyOnlineAsync(verify);
        var active = MembershipOf(res.Membership.Id);
        Assert.Equal(MembershipStatus.Active, active.Status);
        var activatedAt = active.UpdatedAt;

        // Checkout's verify and the webhook racing / repeating: still one payment, membership untouched.
        using (var s = Services(AsMember())) await s.Payments.VerifyOnlineAsync(verify);
        var body = JsonSerializer.Serialize(new
        {
            @event = "payment.captured",
            payload = new { payment = new { entity = new { id = "pay_1", status = "captured", method = "upi", amount = order.AmountMinor, order_id = order.OrderId,
                notes = new { invoiceId = order.InvoiceId.ToString(), tenantId = "1" } } } },
        });
        using (var s = Services(System))
        {
            Assert.True(await s.Payments.HandleRazorpayWebhookAsync(1, body, Hmac(WebhookSecret, body)));
            Assert.True(await s.Payments.HandleRazorpayWebhookAsync(1, body, Hmac(WebhookSecret, body)));
        }
        using var check = _db.Create(null);
        Assert.Single(check.Payments.Where(p => p.InvoiceId == order.InvoiceId));
        Assert.Equal(InvoiceStatus.Paid, check.Invoices.Single(i => i.Id == order.InvoiceId).Status);
        Assert.Equal(activatedAt, check.GymMemberships.Single(m => m.Id == res.Membership.Id).UpdatedAt);
        Assert.Null(await MembershipRules.BlockReasonAsync(check, Member));
    }

    [Fact]
    public async Task Webhook_alone_activates_when_the_app_closed_before_verifying()
    {
        EnableGateway();
        var order = (await CheckoutAsync(_premium)).Order!;
        _rzp.Payments["pay_9"] = new RazorpayPaymentInfo("pay_9", "captured", "card", order.AmountMinor, order.OrderId);
        var body = JsonSerializer.Serialize(new
        {
            @event = "payment.captured",
            payload = new { payment = new { entity = new { id = "pay_9", status = "captured", method = "card", amount = order.AmountMinor, order_id = order.OrderId,
                notes = new { invoiceId = order.InvoiceId.ToString(), tenantId = "1" } } } },
        });
        using (var s = Services(System)) Assert.True(await s.Payments.HandleRazorpayWebhookAsync(1, body, Hmac(WebhookSecret, body)));
        using var db = _db.Create(null);
        Assert.Equal(MembershipStatus.Active, db.GymMemberships.Single(m => m.UserId == Member).Status);
    }

    [Fact]
    public async Task Without_a_gateway_the_membership_stays_pending_with_an_unpaid_invoice_until_the_desk_takes_payment()
    {
        var res = await CheckoutAsync(_basic);
        Assert.True(res.PayAtDesk);
        Assert.Null(res.Order);
        Assert.Equal("Pending", res.Membership.Status);
        Assert.Equal(1500m, res.Invoice.Balance);
        Assert.Equal(1, NotificationsFor(Admin)); // staff told to collect

        // Nothing activates it on its own.
        Assert.Equal(MembershipStatus.Pending, MembershipOf(res.Membership.Id).Status);
        using (var s = Services(AsMember()))
        {
            var mine = await s.Requests.GetMyMembershipAsync();
            Assert.Equal("Pending", mine.Current!.Status);
            Assert.Equal(res.Invoice.Id, mine.PendingInvoice!.Id);
            Assert.False(mine.CanFreeze);
        }

        // Paying at the desk is what turns it on.
        using (var s = Services(AsAdmin()))
            await s.Payments.ChargeAsync(new ChargeRequest { MemberId = Member, InvoiceId = res.Invoice.Id, Method = "cash", IdempotencyKey = "desk-1" });
        Assert.Equal(MembershipStatus.Active, MembershipOf(res.Membership.Id).Status);
    }

    [Fact]
    public async Task Repeating_checkout_reuses_the_unpaid_one_and_a_different_plan_supersedes_it()
    {
        EnableGateway();
        var first = await CheckoutAsync(_basic);
        var again = await CheckoutAsync(_basic);
        Assert.True(again.Reused);
        Assert.Equal(first.Membership.Id, again.Membership.Id);
        Assert.Equal(first.Invoice.Id, again.Invoice.Id);

        var other = await CheckoutAsync(_premium);
        Assert.NotEqual(first.Membership.Id, other.Membership.Id);
        using var db = _db.Create(null);
        Assert.Equal(InvoiceStatus.Void, db.Invoices.Single(i => i.Id == first.Invoice.Id).Status);
        Assert.Equal(MembershipStatus.Cancelled, db.GymMemberships.Single(m => m.Id == first.Membership.Id).Status);
        Assert.Single(db.GymMemberships.Where(m => m.UserId == Member && m.Status == MembershipStatus.Pending));
    }

    [Fact]
    public async Task Online_join_can_be_switched_off_and_a_live_member_cannot_buy_a_second_plan()
    {
        GiveActiveMembership();
        await Assert.ThrowsAsync<RuleException>(() => CheckoutAsync(_premium));
        await SetRulesAsync(r => r.AllowOnlineJoin = false);
        var ex = await Assert.ThrowsAsync<RuleException>(() => CheckoutAsync(_premium));
        Assert.Contains("front desk", ex.Message);
    }

    [Fact]
    public async Task Safety_gate_blocks_checkout_when_the_gym_requires_it()
    {
        using (var db = _db.Create(AsAdmin()))
            await new SafetyGate(db, AsAdmin()).SaveSettingsAsync(1, new SafetySettings { GatingEnabled = true });
        using (var s = Services(AsMember()))
            Assert.True((await s.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic })).SafetyRequired);
        await Assert.ThrowsAsync<SafetyGateException>(() => CheckoutAsync(_basic));
    }

    // ── Cancellation maths ─────────────────────────────────────────────────

    [Fact]
    public void Cancel_end_date_is_the_latest_of_paid_through_notice_and_minimum_term()
    {
        var today = new DateOnly(2026, 3, 1);
        var start = new DateOnly(2026, 1, 15);
        var rules = new MembershipRulesSettings { NoticeDays = 30, MinimumTermMonths = 0, CancellationFee = 250 };

        // Notice runs past the paid-through date: the extra days are billed pro rata.
        var c = MembershipMath.Cancel(today, start, new DateOnly(2026, 3, 10), 3000, 30, rules);
        Assert.Equal(new DateOnly(2026, 3, 31), c.LastDay);
        Assert.Equal(21, c.UncoveredDays);
        Assert.Equal(2100m, c.UncoveredCharge);
        Assert.Equal(2350m, c.FinalCharge);

        // Prepaid well beyond the notice: access to the paid-through date, nothing more to pay but the fee.
        c = MembershipMath.Cancel(today, start, new DateOnly(2026, 6, 1), 3000, 30, rules);
        Assert.Equal(new DateOnly(2026, 6, 1), c.LastDay);
        Assert.Equal(0, c.UncoveredDays);
        Assert.Equal(250m, c.FinalCharge);

        // A 12-month minimum term wins.
        rules.MinimumTermMonths = 12;
        c = MembershipMath.Cancel(today, start, new DateOnly(2026, 3, 10), 3000, 30, rules);
        Assert.Equal(new DateOnly(2027, 1, 14), c.LastDay);
        Assert.Equal(new DateOnly(2027, 1, 14), c.MinimumTermEnd);
        Assert.Equal(310, c.UncoveredDays);

        // No notice, no term: the paid-through date.
        c = MembershipMath.Cancel(today, start, new DateOnly(2026, 3, 10), 3000, 30, new MembershipRulesSettings { NoticeDays = 0 });
        Assert.Equal(new DateOnly(2026, 3, 10), c.LastDay);
        Assert.Equal(0m, c.FinalCharge);
    }

    [Fact]
    public void Upgrade_is_pro_rated_for_the_days_left()
    {
        Assert.True(MembershipMath.IsUpgrade(1000, 30, 3000, 30));
        Assert.False(MembershipMath.IsUpgrade(3000, 30, 1000, 30));
        var (days, charge) = MembershipMath.UpgradeCharge(new DateOnly(2026, 3, 1), new DateOnly(2026, 3, 15), 1000, 30, 3000, 30);
        Assert.Equal(15, days);
        Assert.Equal(1000m, charge); // (100 − 33.33…) × 15
    }

    // ── Freeze allowance ───────────────────────────────────────────────────

    [Fact]
    public void Freeze_rules_enforce_allowance_minimum_length_and_dates()
    {
        var rules = new MembershipRulesSettings { MaxFreezeDaysPerYear = 30, MinFreezeDays = 7 };
        var today = new DateOnly(2026, 3, 1);
        Assert.Null(MembershipMath.FreezeProblem(today, new DateOnly(2026, 3, 10), new DateOnly(2026, 3, 29), 0, rules, null));
        Assert.Contains("10 pause days left", MembershipMath.FreezeProblem(today, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 15), 20, rules, null));
        Assert.Contains("used all 30", MembershipMath.FreezeProblem(today, new DateOnly(2026, 5, 1), new DateOnly(2026, 5, 10), 30, rules, null));
        Assert.Contains("at least 7", MembershipMath.FreezeProblem(today, new DateOnly(2026, 3, 2), new DateOnly(2026, 3, 4), 0, rules, null));
        Assert.Contains("from today", MembershipMath.FreezeProblem(today, new DateOnly(2026, 2, 20), new DateOnly(2026, 3, 4), 0, rules, null));
        Assert.Contains("ends on", MembershipMath.FreezeProblem(today, new DateOnly(2026, 4, 2), new DateOnly(2026, 4, 12), 0, rules, new DateOnly(2026, 4, 1)));
        // Across new year only the days inside the start year count against that year.
        Assert.Equal(5, MembershipMath.DaysInYear([(new DateOnly(2026, 12, 27), new DateOnly(2027, 1, 5))], 2026));
    }

    [Fact]
    public async Task Freeze_requests_are_auto_approved_within_the_allowance_and_refused_beyond_it()
    {
        await SetRulesAsync(r => { r.MaxFreezeDaysPerYear = 30; r.MinFreezeDays = 7; });
        var membershipId = GiveActiveMembership(Today.AddDays(-5));
        var from = Today.AddDays(1);
        using (var s = Services(AsMember()))
        {
            var first = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "freeze", From = from, To = from.AddDays(9), Reason = "Travel" });
            Assert.Equal("approved", first.Status);
            Assert.True(first.AutoApproved);
            Assert.Null(first.AppliedAt); // starts tomorrow
        }
        Assert.Equal(1, NotificationsFor(Admin)); // staff are told about auto-approved pauses too

        using (var s = Services(AsMember()))
        {
            var preview = await s.Requests.PreviewAsync(new CreateMembershipRequestRequest { Type = "freeze", From = from.AddDays(15), To = from.AddDays(15 + 24) });
            Assert.False(preview.Allowed);
            Assert.Contains("pause days left", preview.Problem);
            await Assert.ThrowsAsync<RuleException>(() => s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "freeze", From = from.AddDays(15), To = from.AddDays(15 + 24) }));
            // Overlapping the booked pause is refused too.
            await Assert.ThrowsAsync<RuleException>(() => s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "freeze", From = from.AddDays(2), To = from.AddDays(9) }));
        }

        // The job starts the pause on its first day and gives the days back after the last one.
        var endsBefore = MembershipOf(membershipId).EndsAt!.Value;
        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, from);
        Assert.Equal(MembershipStatus.Paused, MembershipOf(membershipId).Status);
        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, from.AddDays(10));
        var after = MembershipOf(membershipId);
        Assert.Equal(MembershipStatus.Active, after.Status);
        Assert.True(after.EndsAt >= endsBefore);
        using (var db = _db.Create(null))
            Assert.NotNull(db.MembershipRequests.Single(r => r.Type == "freeze").CompletedAt);
    }

    [Fact]
    public async Task Freeze_needs_staff_when_the_gym_says_so()
    {
        await SetRulesAsync(r => r.FreezeApproval = "staff");
        GiveActiveMembership();
        using var s = Services(AsMember());
        var r = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "freeze", From = Today, To = Today.AddDays(9) });
        Assert.Equal("pending", r.Status);
        Assert.Equal(MembershipStatus.Active, MembershipOf(r.MembershipId).Status);
    }

    // ── Cancel / approval / withdraw ───────────────────────────────────────

    [Fact]
    public async Task Cancel_needs_approval_by_default_and_approval_uses_the_existing_cancel_logic()
    {
        await SetRulesAsync(r => { r.NoticeDays = 30; r.CancellationFee = 200; });
        var membershipId = GiveActiveMembership(Today.AddDays(-20)); // paid through today + 10
        MembershipRequestResponse req;
        using (var s = Services(AsMember()))
        {
            var preview = await s.Requests.PreviewAsync(new CreateMembershipRequestRequest { Type = "cancel" });
            Assert.True(preview.Allowed);
            Assert.True(preview.NeedsApproval);
            Assert.True(preview.CanPauseInstead);
            Assert.Equal(Today.AddDays(30), preview.Cancel!.LastDay);
            Assert.Equal(20, preview.Cancel.UncoveredDays);
            Assert.Equal(Money.Round(1000m / 30 * 20) + 200, preview.Fee);

            req = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "cancel", ReasonCode = "moving" });
            Assert.Equal("pending", req.Status);
        }
        Assert.Equal(1, NotificationsFor(Admin));
        Assert.Equal(MembershipStatus.Active, MembershipOf(membershipId).Status);

        using (var s = Services(AsAdmin()))
        {
            Assert.Equal(1, await s.Requests.CountPendingAsync());
            var decided = await s.Requests.ApproveAsync(req.Id, new DecideMembershipRequestRequest { Note = "Sorry to see you go" });
            Assert.Equal("approved", decided.Status);
            Assert.False(decided.AutoApproved);
            Assert.NotNull(decided.InvoiceId);
            await Assert.ThrowsAsync<RuleException>(() => s.Requests.ApproveAsync(req.Id, new DecideMembershipRequestRequest()));
        }
        using (var n = _db.Create(null)) Assert.Single(n.Set<Notification>().Where(x => x.UserId == Member && x.Title.Contains("approved")));
        var m = MembershipOf(membershipId);
        Assert.False(m.AutoRenew);
        Assert.Equal(Today.AddDays(30), m.EndsAt);
        Assert.Equal(MembershipStatus.Active, m.Status); // still training until the last day

        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, Today.AddDays(30));
        Assert.Equal(MembershipStatus.Active, MembershipOf(membershipId).Status);
        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, Today.AddDays(31));
        Assert.Equal(MembershipStatus.Cancelled, MembershipOf(membershipId).Status);
        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, Today.AddDays(32)); // idempotent
    }

    [Fact]
    public async Task Self_cancel_can_be_turned_off()
    {
        await SetRulesAsync(r => r.AllowSelfCancel = false);
        GiveActiveMembership();
        using var s = Services(AsMember());
        var p = await s.Requests.PreviewAsync(new CreateMembershipRequestRequest { Type = "cancel" });
        Assert.False(p.Allowed);
        Assert.Contains("front desk", p.Problem);
    }

    [Fact]
    public async Task Member_can_withdraw_a_pending_request_but_not_a_decided_one()
    {
        GiveActiveMembership();
        using var s = Services(AsMember());
        var r = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "cancel" });
        var w = await s.Requests.WithdrawAsync(r.Id);
        Assert.Equal("withdrawn", w.Status);
        await Assert.ThrowsAsync<RuleException>(() => s.Requests.WithdrawAsync(r.Id));

        using (var admin = Services(AsAdmin()))
            await Assert.ThrowsAsync<RuleException>(() => admin.Requests.ApproveAsync(r.Id, new DecideMembershipRequestRequest()));

        // A new one can be made after withdrawing; rejected ones need a note and can't be withdrawn.
        var again = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "cancel" });
        using (var admin = Services(AsAdmin()))
        {
            await Assert.ThrowsAsync<ArgumentException>(() => admin.Requests.RejectAsync(again.Id, new DecideMembershipRequestRequest()));
            Assert.Equal("rejected", (await admin.Requests.RejectAsync(again.Id, new DecideMembershipRequestRequest { Note = "Minimum term applies" })).Status);
        }
        using var fresh = Services(AsMember());
        await Assert.ThrowsAsync<RuleException>(() => fresh.Requests.WithdrawAsync(again.Id));
    }

    // ── Plan change ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Upgrade_applies_now_with_a_pro_rated_invoice_and_downgrade_waits_for_renewal()
    {
        var membershipId = GiveActiveMembership(Today.AddDays(-15)); // Basic, ends today + 15
        using (var s = Services(AsMember()))
        {
            var preview = await s.Requests.PreviewAsync(new CreateMembershipRequestRequest { Type = "change", NewPlanId = _premium });
            Assert.Equal("upgrade", preview.ChangeKind);
            Assert.Equal(Today, preview.EffectiveFrom);
            var up = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "change", NewPlanId = _premium });
            Assert.Equal("approved", up.Status);
            Assert.NotNull(up.AppliedAt);
            Assert.NotNull(up.InvoiceId);
            Assert.True(up.Fee > 0);
        }
        Assert.Equal(_premium, MembershipOf(membershipId).PlanId);

        using (var s = Services(AsMember()))
        {
            var down = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "change", NewPlanId = _basic });
            Assert.Equal("approved", down.Status);
            Assert.Null(down.AppliedAt);
            Assert.Equal(MembershipOf(membershipId).EndsAt, down.EffectiveFrom);
            Assert.Equal(0m, down.Fee);
        }
        Assert.Equal(_premium, MembershipOf(membershipId).PlanId);
        using (var s = Services(System)) await s.Requests.ApplyDueAsync(1, MembershipOf(membershipId).EndsAt!.Value);
        Assert.Equal(_basic, MembershipOf(membershipId).PlanId);
    }

    // ── Tenant isolation ───────────────────────────────────────────────────

    [Fact]
    public async Task Requests_rules_and_plans_stay_inside_their_gym()
    {
        GiveActiveMembership();
        MembershipRequestResponse r;
        using (var s = Services(AsMember())) r = await s.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "cancel" });

        using (var other = Services(AsAdmin(OtherGymAdmin, 2)))
        {
            Assert.Empty((await other.Requests.ListAsync("all", null, null, 1, 20)).Items);
            Assert.Equal(0, await other.Requests.CountPendingAsync());
            await Assert.ThrowsAsync<KeyNotFoundException>(() => other.Requests.GetAsync(r.Id));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => other.Requests.ApproveAsync(r.Id, new DecideMembershipRequestRequest()));
        }
        using (var stranger = Services(AsMember(OtherGymMember, 2)))
        {
            await Assert.ThrowsAsync<KeyNotFoundException>(() => stranger.Requests.GetMineAsync(r.Id));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => stranger.Requests.WithdrawAsync(r.Id));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => stranger.Requests.CreateAsync(new CreateMembershipRequestRequest { Type = "cancel", MembershipId = r.MembershipId }));
            Assert.Equal(["Gym 2 plan"], (await stranger.Plans.GetCatalogAsync()).Plans.Select(p => p.Name).ToArray());
            await Assert.ThrowsAsync<KeyNotFoundException>(() => stranger.Plans.QuoteAsync(new JoinQuoteRequest { PlanId = _basic }));
        }
        await SetRulesAsync(x => x.NoticeDays = 90, tenant: 2);
        using (var db = _db.Create(null))
            Assert.Equal(30, (await MembershipRulesStore.LoadAsync(db, 1)).NoticeDays);
        using (var mine = Services(AsAdmin()))
            Assert.Single((await mine.Requests.ListAsync("pending", "cancel", null, 1, 20)).Items);
    }

    // ── Fakes ───────────────────────────────────────────────────────────────

    private sealed class FakeRazorpay : IRazorpayClient
    {
        private int _orders;
        public Dictionary<string, RazorpayPaymentInfo> Payments { get; } = [];

        public Task<RazorpayOrder> CreateOrderAsync(RazorpayKeys keys, decimal amount, string currency, string receipt, IDictionary<string, string> notes) =>
            Task.FromResult(new RazorpayOrder($"order_{++_orders}", RazorpayApi.ToMinor(amount), currency));
        public Task<RazorpayPaymentInfo> GetPaymentAsync(RazorpayKeys keys, string paymentId) => Task.FromResult(Payments[paymentId]);
        public Task<string> RefundAsync(RazorpayKeys keys, string paymentId, decimal amount, string? receipt = null) => Task.FromResult("rfnd_1");
        public Task<RazorpayPaymentInfo> CaptureAsync(RazorpayKeys keys, string paymentId, long amountMinor, string currency) =>
            Task.FromResult(Payments[paymentId] with { Status = "captured" });
        public Task<IReadOnlyDictionary<string, string>> GetOrderNotesAsync(RazorpayKeys keys, string orderId) =>
            Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
        public Task<bool> TestKeysAsync(RazorpayKeys keys) => Task.FromResult(true);
    }

    private sealed class PlainSecrets : ISecretProtector
    {
        public string Protect(string plaintext) => plaintext;
        public string? Unprotect(string? protectedValue) => protectedValue;
    }

    private sealed class NullOutbox : IEmailOutbox
    {
        public void Enqueue(ulong tenantId, ulong? userId, string to, string subject, string htmlBody, string? dedupeKey = null) { }
        public Task<HashSet<string>> AlreadyQueuedAsync(ulong tenantId, IReadOnlyCollection<string> dedupeKeys, CancellationToken ct = default) =>
            Task.FromResult(new HashSet<string>());
    }
}
