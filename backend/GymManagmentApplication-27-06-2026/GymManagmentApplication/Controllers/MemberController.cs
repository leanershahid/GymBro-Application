using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/members")]
[AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
public class MemberController(IMemberService service, IValidator<CreateMemberRequest> validator) : ControllerBase
{
    [HttpGet]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetAll([FromQuery] MemberSearchRequest request)
        => Ok(ApiResponse<object>.Ok(await service.GetAllAsync(request)));

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateMemberRequest request)
    {
        var v = await validator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, ApiResponse<object>.Ok(result, "Member created."));
    }

    [HttpGet("{id}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Member {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateMemberRequest request)
    {
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail($"Member {id} not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpDelete("{id}")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var deleted = await service.DeleteAsync(id);
        return deleted ? Ok(ApiResponse<object>.Ok((object)null!, "Member archived.")) : NotFound(ApiResponse<object>.Fail($"Member {id} not found."));
    }

    [HttpPost("bulk")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> BulkImport([FromBody] BulkImportMemberRequest request)
        => Ok(ApiResponse<object>.Ok(await service.BulkImportAsync(request)));

    [HttpGet("{id}/timeline")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetTimeline(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetTimelineAsync(id)));

    [HttpPost("{id}/photo")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> UploadPhoto(ulong id, IFormFile photo)
    {
        var url = await service.UploadPhotoAsync(id, photo);
        return Ok(ApiResponse<object>.Ok(new { url }));
    }

    [HttpGet("{id}/notes")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetNotes(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetNotesAsync(id)));

    [HttpPost("{id}/notes")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> AddNote(ulong id, [FromBody] AddMemberNoteRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AddNoteAsync(id, request)));

    [HttpGet("{id}/documents")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> GetDocuments(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetDocumentsAsync(id)));

    [HttpPost("{id}/documents")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer, RoleNames.Client)]
    public async Task<ActionResult<ApiResponse<object>>> UploadDocument(ulong id, IFormFile file, [FromQuery] string? documentType)
        => Ok(ApiResponse<object>.Ok(await service.UploadDocumentAsync(id, file, documentType)));

    [HttpGet("search")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Search([FromQuery] MemberSearchRequest request)
        => Ok(ApiResponse<object>.Ok(await service.SearchAsync(request)));

    [HttpGet("{id}/tags")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> GetTags(ulong id)
        => Ok(ApiResponse<object>.Ok(await service.GetTagsAsync(id)));

    [HttpPost("{id}/tags")]
    [AuthorizeRoles(RoleNames.Admin)]
    public async Task<ActionResult<ApiResponse<object>>> AssignTags(ulong id, [FromBody] AssignTagsRequest request)
        => Ok(ApiResponse<object>.Ok(await service.AssignTagsAsync(id, request)));
}
