using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Tests;

public class BillingTests : IDisposable
{
    private readonly TestDb _db = new();

    public BillingTests()
    {
        _db.SeedGym();
        _db.AddMember(100);
    }

    private static BillingCore.NewInvoice Invoice(decimal price, decimal tax = 0, decimal discount = 0) =>
        new(1, 100, [new InvoiceLineItem { Description = "Monthly", UnitPrice = price, Quantity = 1 }], tax, discount);

    [Fact]
    public async Task Invoice_totals_apply_discount_then_tax_in_gym_currency()
    {
        using var db = _db.Create(new FakeUser());
        var inv = await new BillingCore(db, new GymManagmentApplication.Application.Engagement.Notifier(db, new FakeUser())).CreateInvoiceAsync(Invoice(1000, tax: 18, discount: 100));
        await db.SaveChangesAsync();

        Assert.Equal(1000m, inv.Subtotal);
        Assert.Equal(100m, inv.Discount);
        Assert.Equal(162m, inv.Tax);      // 18% of 900
        Assert.Equal(1062m, inv.Total);
        Assert.Equal("INR", inv.Currency);
        Assert.Equal(InvoiceStatus.Sent, inv.Status);
        Assert.Matches(@"^INV-\d{4}-00001$", inv.InvoiceNo);
    }

    [Fact]
    public async Task Invoice_numbers_increase_per_gym()
    {
        using var db = _db.Create(new FakeUser());
        var billing = new BillingCore(db, new GymManagmentApplication.Application.Engagement.Notifier(db, new FakeUser()));
        var a = await billing.CreateInvoiceAsync(Invoice(10));
        var b = await billing.CreateInvoiceAsync(Invoice(20));
        await db.SaveChangesAsync();
        var c = await billing.CreateInvoiceAsync(Invoice(30));
        Assert.EndsWith("00001", a.InvoiceNo);
        Assert.EndsWith("00002", b.InvoiceNo);
        Assert.EndsWith("00003", c.InvoiceNo);
    }

    [Fact]
    public async Task Partial_payments_settle_the_invoice_only_when_fully_paid()
    {
        using var db = _db.Create(new FakeUser());
        var billing = new BillingCore(db, new GymManagmentApplication.Application.Engagement.Notifier(db, new FakeUser()));
        var inv = await billing.CreateInvoiceAsync(Invoice(1000));
        await db.SaveChangesAsync();

        billing.ApplyPayment(inv, 400, PaymentMethod.Cash, "R1", null, 1, null);
        Assert.Equal(InvoiceStatus.Sent, inv.Status);
        Assert.Equal(600m, BillingCore.Balance(inv));

        billing.ApplyPayment(inv, 600, PaymentMethod.Upi, "UTR123", null, 1, null);
        await db.SaveChangesAsync();
        Assert.Equal(InvoiceStatus.Paid, inv.Status);
        Assert.NotNull(inv.PaidAt);
        Assert.Equal(2, await db.Payments.CountAsync());
    }

    [Fact]
    public async Task Paying_more_than_the_balance_is_rejected()
    {
        using var db = _db.Create(new FakeUser());
        var billing = new BillingCore(db, new GymManagmentApplication.Application.Engagement.Notifier(db, new FakeUser()));
        var inv = await billing.CreateInvoiceAsync(Invoice(500));
        Assert.Throws<ArgumentException>(() => billing.ApplyPayment(inv, 501, PaymentMethod.Cash, null, null, 1, null));
        Assert.Throws<ArgumentException>(() => billing.ApplyPayment(inv, 0, PaymentMethod.Cash, null, null, 1, null));
    }

    [Fact]
    public async Task Refunds_reduce_amount_paid_and_reopen_or_refund_the_invoice()
    {
        using var db = _db.Create(new FakeUser());
        var billing = new BillingCore(db, new GymManagmentApplication.Application.Engagement.Notifier(db, new FakeUser()));
        var inv = await billing.CreateInvoiceAsync(Invoice(1000));
        await db.SaveChangesAsync();
        var payment = billing.ApplyPayment(inv, 1000, PaymentMethod.Card, null, null, 1, null);
        await db.SaveChangesAsync();

        billing.ApplyRefund(payment, 300);
        Assert.Equal(PaymentStatus.Completed, payment.Status);
        Assert.Equal(InvoiceStatus.Sent, inv.Status);
        Assert.Equal(300m, BillingCore.Balance(inv));

        billing.ApplyRefund(payment, 700);
        Assert.Equal(PaymentStatus.Refunded, payment.Status);
        Assert.Equal(InvoiceStatus.Refunded, inv.Status);
        Assert.Throws<ArgumentException>(() => billing.ApplyRefund(payment, 1));
    }

    [Theory]
    [InlineData("cash", PaymentMethod.Cash)]
    [InlineData("UPI", PaymentMethod.Upi)]
    [InlineData("bank-transfer", PaymentMethod.Netbanking)]
    public void Payment_methods_parse(string input, PaymentMethod expected) =>
        Assert.Equal(expected, PaymentService.ParseMethod(input));

    [Fact]
    public void Unknown_payment_method_is_rejected() =>
        Assert.Throws<ArgumentException>(() => PaymentService.ParseMethod("bitcoin-ish"));

    [Theory]
    [InlineData("annual", BillingCycle.Yearly)]
    [InlineData("Half-Yearly", BillingCycle.HalfYearly)]
    [InlineData("monthly", BillingCycle.Monthly)]
    public void Billing_cycles_parse(string input, BillingCycle expected) =>
        Assert.Equal(expected, MembershipPlanService.ParseCycle(input));

    public void Dispose() => _db.Dispose();
}
