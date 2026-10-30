using System.Globalization;
using System.Text.Json;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class InvoiceService(AppDbContext db, ICurrentUser currentUser, BillingCore billing, IEmailSender email) : IInvoiceService
{
    public async Task<PagedResponse<InvoiceResponse>> GetAllAsync(InvoiceListRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var q = db.Invoices.Include(i => i.User).Where(i => i.TenantId == request.TenantId);
        if (request.MemberId.HasValue) q = q.Where(i => i.UserId == request.MemberId);
        switch (request.Status?.Trim().ToLowerInvariant())
        {
            case null or "": break;
            // "unpaid" = anything with money still due
            case "unpaid": q = q.Where(i => (i.Status == InvoiceStatus.Sent || i.Status == InvoiceStatus.Overdue) && i.Total > i.AmountPaid); break;
            default:
                if (Enum.TryParse<InvoiceStatus>(request.Status, true, out var st)) q = q.Where(i => i.Status == st);
                break;
        }
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(i => i.CreatedAt).Page(request.PageNumber, request.PageSize).ToListAsync();
        var (page, size) = Paging.Clamp(request.PageNumber, request.PageSize);
        return new PagedResponse<InvoiceResponse> { Items = items.Select(Map), PageNumber = page, PageSize = size, TotalRecords = total };
    }

    public async Task<InvoiceResponse> GenerateAsync(GenerateInvoiceRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        await db.EnsureUserAsync(request.MemberId, request.TenantId);
        var invoice = await billing.CreateInvoiceAsync(new BillingCore.NewInvoice(
            request.TenantId, request.MemberId, request.Items, request.TaxPercent, request.Discount,
            request.DueDate ?? DateOnly.FromDateTime(DateTime.UtcNow), request.Notes));
        await db.SaveChangesAsync();
        await db.Entry(invoice).Reference(i => i.User).LoadAsync();
        return Map(invoice);
    }

    public async Task<InvoiceResponse?> GetByIdAsync(ulong id)
    {
        var inv = await db.Invoices.Include(i => i.User).FirstOrDefaultAsync(i => i.Id == id);
        return inv is null ? null : Map(inv);
    }

    public async Task<byte[]?> GetPdfAsync(ulong id)
    {
        var inv = await db.Invoices.Include(i => i.Tenant).Include(i => i.User).FirstOrDefaultAsync(i => i.Id == id);
        return inv is null ? null : BuildPdf(inv);
    }

    public static byte[] BuildPdf(Invoice inv)
    {
        string Money(decimal v) => $"{v.ToString("N2", CultureInfo.InvariantCulture)} {inv.Currency}";
        var lines = new List<InvoicePdfWriter.Line>
        {
            new(inv.Tenant.Name, 18, Bold: true),
            new($"INVOICE {inv.InvoiceNo}", 14, Bold: true),
            new(""),
            new($"Issued:   {inv.CreatedAt:yyyy-MM-dd}"),
            new($"Due:      {(inv.DueDate?.ToString("yyyy-MM-dd") ?? "-")}"),
            new($"Status:   {inv.Status}"),
            new($"Billed to: {$"{inv.User.FirstName} {inv.User.LastName}".Trim()} <{inv.User.Email}>"),
            new(""),
        };
        foreach (var item in ReadItems(inv))
            lines.Add(new($"{item.Quantity} x {item.Description}  @ {Money(item.UnitPrice)}  = {Money(item.UnitPrice * item.Quantity)}"));
        lines.AddRange([
            new(""),
            new($"Subtotal: {Money(inv.Subtotal)}"),
            new($"Discount: -{Money(inv.Discount)}"),
            new($"Tax:      {Money(inv.Tax)}"),
            new($"Total:    {Money(inv.Total)}", 13, Bold: true),
            new($"Paid:     {Money(inv.AmountPaid)}"),
            new($"Due now:  {Money(BillingCore.Balance(inv))}", 12, Bold: true),
        ]);
        if (inv.PaidAt is { } paid) lines.Add(new($"Paid in full on {paid:yyyy-MM-dd}"));
        if (!string.IsNullOrWhiteSpace(inv.Notes)) { lines.Add(new("")); lines.Add(new($"Notes: {inv.Notes}")); }
        return InvoicePdfWriter.Write(lines);
    }

    /// <summary>Emails the invoice PDF to the member.</summary>
    public async Task<bool> SendAsync(ulong id, SendInvoiceRequest request)
    {
        var inv = await db.Invoices.Include(i => i.Tenant).Include(i => i.User).FirstOrDefaultAsync(i => i.Id == id);
        if (inv is null) return false;
        if (string.IsNullOrEmpty(inv.User.Email)) throw new ArgumentException("This member has no email address.");

        var note = string.IsNullOrWhiteSpace(request.AdditionalMessage) ? "" : $"<p>{System.Net.WebUtility.HtmlEncode(request.AdditionalMessage.Trim())}</p>";
        var html = EmailTemplates.Wrap($"Invoice {inv.InvoiceNo}", $"""
            <p>Hi {System.Net.WebUtility.HtmlEncode(inv.User.FirstName ?? "there")},</p>
            <p>Your invoice from {System.Net.WebUtility.HtmlEncode(inv.Tenant.Name)} is attached.</p>
            <p><b>Total:</b> {inv.Total:N2} {inv.Currency}<br/><b>Due now:</b> {BillingCore.Balance(inv):N2} {inv.Currency}</p>{note}
            """);
        var sent = await email.SendAsync(inv.User.Email, $"Invoice {inv.InvoiceNo} from {inv.Tenant.Name}", html,
            [($"{inv.InvoiceNo}.pdf", BuildPdf(inv), "application/pdf")]);
        if (!sent) throw new InvalidOperationException("The invoice email couldn't be sent. Check the email settings.");
        if (inv.Status == InvoiceStatus.Draft) inv.Status = InvoiceStatus.Sent;
        await db.SaveChangesAsync();
        return true;
    }

    /// <summary>Settles the remaining balance with a desk payment (so revenue reports include it).</summary>
    public async Task<InvoiceResponse?> MarkPaidAsync(ulong id, MarkInvoicePaidRequest? request = null)
    {
        var inv = await db.Invoices.Include(i => i.User).FirstOrDefaultAsync(i => i.Id == id);
        if (inv is null) return null;
        billing.ApplyPayment(inv, BillingCore.Balance(inv), PaymentService.ParseMethod(request?.Method),
            request?.Reference, null, currentUser.UserId, "Marked paid");
        await db.SaveChangesAsync();
        return Map(inv);
    }

    public static List<InvoiceItemResponse> ReadItems(Invoice i)
    {
        if (i.Items is null) return [];
        try
        {
            return JsonSerializer.Deserialize<List<InvoiceItemResponse>>(i.Items.RootElement.GetRawText(),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch (JsonException) { return []; }
    }

    public static InvoiceResponse Map(Invoice i) => new()
    {
        Id = i.Id, TenantId = i.TenantId, MemberId = i.UserId,
        InvoiceNo = i.InvoiceNo,
        Subtotal = i.Subtotal, Tax = i.Tax, Discount = i.Discount, Total = i.Total,
        AmountPaid = i.AmountPaid, Balance = BillingCore.Balance(i),
        Currency = i.Currency, Status = i.Status.ToString(), DueDate = i.DueDate,
        IssuedAt = i.CreatedAt, PaidAt = i.PaidAt, Notes = i.Notes, MembershipId = i.MembershipId,
        MemberName = i.User is null ? null : $"{i.User.FirstName} {i.User.LastName}".Trim(),
        Items = ReadItems(i),
    };
}
