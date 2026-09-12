using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/invoices")]
[AuthorizeRoles(RoleNames.Admin)]
public class InvoiceController(IInvoiceService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll(
        [FromQuery] InvoiceListRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(request)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Generate(
        [FromBody] GenerateInvoiceRequest request)
    {
        var result = await service.GenerateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id },
            ApiResponse<object>.Ok(result, "Invoice generated."));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Invoice {id} not found."))
            : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("{id:long}/pdf")]
    public async Task<IActionResult> GetPdf(ulong id)
    {
        var bytes = await service.GetPdfAsync(id);
        if (bytes is null) return NotFound();
        return File(bytes, "application/pdf", $"invoice-{id}.pdf");
    }

    [HttpPost("{id:long}/send")]
    public async Task<ActionResult<ApiResponse<object>>> Send(ulong id,
        [FromBody] SendInvoiceRequest request)
    {
        var ok = await service.SendAsync(id, request);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Invoice sent."))
            : NotFound(ApiResponse<object>.Fail($"Invoice {id} not found."));
    }

    [HttpPut("{id:long}/mark-paid")]
    public async Task<ActionResult<ApiResponse<object>>> MarkPaid(ulong id)
    {
        var result = await service.MarkPaidAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Invoice {id} not found."))
            : Ok(ApiResponse<object>.Ok(result, "Invoice marked as paid."));
    }
}
