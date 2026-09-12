using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Billing.Services;

public class InvoiceService(AppDbContext db) : IInvoiceService
{
    public async Task<PagedResponse<InvoiceResponse>> GetAllAsync(InvoiceListRequest request)
    {
        var q = db.Invoices.AsQueryable();
        if (request.TenantId.HasValue) q = q.Where(i => i.TenantId == request.TenantId);
        if (request.MemberId.HasValue) q = q.Where(i => i.UserId == request.MemberId);
        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<InvoiceStatus>(request.Status, true, out var st))
            q = q.Where(i => i.Status == st);
        var total = await q.CountAsync();
        var items = await q.OrderByDescending(i => i.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize).ToListAsync();
        return new PagedResponse<InvoiceResponse>
        {
            Items = items.Select(Map), PageNumber = request.PageNumber,
            PageSize = request.PageSize, TotalRecords = total
        };
    }

    public async Task<InvoiceResponse> GenerateAsync(GenerateInvoiceRequest request)
    {
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
        var inv = await db.Invoices.FindAsync(id);
        if (inv is null) return null;
        // Return placeholder PDF bytes — real impl would use a PDF library
        var content = $"INVOICE {inv.InvoiceNo}\nTotal: {inv.Total} {inv.Currency}";
        return System.Text.Encoding.UTF8.GetBytes(content);
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
        (await db.Invoices.MaxAsync(i => (ulong?)i.Id) ?? 0) + 1;
}
