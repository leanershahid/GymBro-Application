using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class InvoiceService(AppDbContext db, ICurrentUser currentUser) : IInvoiceService
{
    public async Task<PagedResponse<InvoiceResponse>> GetAllAsync(InvoiceListRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var q = db.Invoices.AsQueryable();
        if (request.TenantId.HasValue) q = q.Where(i => i.TenantId == request.TenantId);
        if (request.MemberId.HasValue) q = q.Where(i => i.UserId == request.MemberId);
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<InvoiceStatus>(request.Status, true, out var st))
            q = q.Where(i => i.Status == st);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(i => i.CreatedAt)
            .Page(request.PageNumber, request.PageSize).ToListAsync();
        return new PagedResponse<InvoiceResponse>
        {
            Items = items.Select(Map), PageNumber = request.PageNumber,
            PageSize = request.PageSize, TotalRecords = total
        };
    }

    public async Task<InvoiceResponse> GenerateAsync(GenerateInvoiceRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        await db.EnsureUserAsync(request.MemberId, request.TenantId);
        decimal subtotal = request.Items.Sum(i => i.UnitPrice * i.Quantity);
        var invoice = new Invoice
        {
            Id = await NextIdAsync(),
            TenantId = request.TenantId,
            UserId = request.MemberId,
            InvoiceNo = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}",
            Subtotal = subtotal, Tax = 0, Discount = 0, Total = subtotal,
            Currency = "USD", Status = InvoiceStatus.Sent,
            DueDate = request.DueDate, Notes = request.Notes
        };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync();
        return Map(invoice);
    }

    public async Task<InvoiceResponse?> GetByIdAsync(ulong id)
    {
        var inv = await db.Invoices.FindAsync(id);
        return inv is null ? null : Map(inv);
    }

    public async Task<byte[]?> GetPdfAsync(ulong id)
    {
        var inv = await db.Invoices
            .Include(i => i.Tenant)
            .Include(i => i.User)
            .FirstOrDefaultAsync(i => i.Id == id);
        if (inv is null) return null;

        string Money(decimal v) => $"{v.ToString("N2", System.Globalization.CultureInfo.InvariantCulture)} {inv.Currency}";
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
            new($"Subtotal: {Money(inv.Subtotal)}"),
            new($"Tax:      {Money(inv.Tax)}"),
            new($"Discount: {Money(inv.Discount)}"),
            new($"Total:    {Money(inv.Total)}", 13, Bold: true),
        };
        if (inv.PaidAt is { } paid) lines.Add(new($"Paid on {paid:yyyy-MM-dd}"));
        if (!string.IsNullOrWhiteSpace(inv.Notes)) { lines.Add(new("")); lines.Add(new($"Notes: {inv.Notes}")); }

        return InvoicePdfWriter.Write(lines);
    }

    public async Task<bool> SendAsync(ulong id, SendInvoiceRequest request)
    {
        var inv = await db.Invoices.FindAsync(id);
        if (inv is null) return false;
        inv.Status = InvoiceStatus.Sent;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<InvoiceResponse?> MarkPaidAsync(ulong id)
    {
        var inv = await db.Invoices.FindAsync(id);
        if (inv is null) return null;
        inv.Status = InvoiceStatus.Paid;
        inv.PaidAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(inv);
    }

    private static InvoiceResponse Map(Invoice i) => new()
    {
        Id = i.Id, TenantId = i.TenantId, MemberId = i.UserId,
        Subtotal = i.Subtotal, Tax = i.Tax, Discount = i.Discount,
        Total = i.Total, Currency = i.Currency,
        Status = i.Status.ToString(), DueDate = i.DueDate,
        IssuedAt = i.CreatedAt, Notes = i.Notes
    };

    private async Task<ulong> NextIdAsync() =>
        (await db.Invoices.IgnoreQueryFilters().MaxAsync(i => (ulong?)i.Id) ?? 0) + 1;
}
