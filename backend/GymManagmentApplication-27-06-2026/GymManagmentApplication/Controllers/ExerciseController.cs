using System.Security.Claims;
using FluentValidation;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Exercise.Interfaces;
using GymManagmentApplication.Application.Exercise.Requests;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;
using GymManagmentApplication.Domain.Constants;

namespace GymManagmentApplication.Controllers;

[ApiController]
[Route("api/exercises")]
[RequireModule("exercises")]
public class ExerciseController(
    IExerciseService service,
    IValidator<CreateExerciseRequest> createValidator,
    IValidator<UpdateExerciseRequest> updateValidator,
    IValidator<AnnotateVideoRequest> annotateValidator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> List([FromQuery] ExerciseListRequest request)
    {
        var result = await service.GetAllAsync(request);
        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] CreateExerciseRequest request)
    {
        var v = await createValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var userId = ulong.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "0");
        var result = await service.CreateAsync(userId, request);
        return Ok(ApiResponse<object>.Ok(result, "Exercise created."));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetById(ulong id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null ? NotFound(ApiResponse<object>.Fail("Exercise not found.")) : Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPut("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Update(ulong id, [FromBody] UpdateExerciseRequest request)
    {
        var v = await updateValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.UpdateAsync(id, request);
        return result is null ? NotFound(ApiResponse<object>.Fail("Exercise not found.")) : Ok(ApiResponse<object>.Ok(result, "Exercise updated."));
    }

    [HttpDelete("{id:long}")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> Delete(ulong id)
    {
        var ok = await service.DeleteAsync(id);
        return ok ? Ok(ApiResponse<object>.Ok((object)null!, "Exercise deleted.")) : NotFound(ApiResponse<object>.Fail("Exercise not found."));
    }

    [HttpGet("{id:long}/alternatives")]
    public async Task<ActionResult<ApiResponse<object>>> Alternatives(ulong id)
    {
        var result = await service.GetAlternativesAsync(id);
        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpPost("{id:long}/video")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> UploadVideo(ulong id, IFormFile video)
    {
        var url = await service.UploadVideoAsync(id, video);
        return string.IsNullOrEmpty(url)
            ? NotFound(ApiResponse<object>.Fail("Exercise not found."))
            : Ok(ApiResponse<object>.Ok(new { url }, "Video uploaded."));
    }

    [HttpPost("{id:long}/video/annotate")]
    [AuthorizeRoles(RoleNames.Admin, RoleNames.Trainer)]
    public async Task<ActionResult<ApiResponse<object>>> AnnotateVideo(ulong id, [FromBody] AnnotateVideoRequest request)
    {
        var v = await annotateValidator.ValidateAsync(request);
        if (!v.IsValid) return BadRequest(ApiResponse<object>.Fail("Validation failed.", v.Errors.Select(e => e.ErrorMessage).ToList()));
        var result = await service.AnnotateVideoAsync(id, request);
        return Ok(ApiResponse<object>.Ok(result, "Annotations saved."));
    }

    [HttpGet("tags")]
    public async Task<ActionResult<ApiResponse<object>>> GetTags()
    {
        var result = await service.GetTagsAsync();
        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("muscles")]
    public async Task<ActionResult<ApiResponse<object>>> GetMuscles()
    {
        var result = await service.GetMusclesAsync();
        return Ok(ApiResponse<object>.Ok(result));
    }

    [HttpGet("equipment")]
    public async Task<ActionResult<ApiResponse<object>>> GetByEquipment([FromQuery] ExerciseListRequest request)
    {
        var result = await service.GetByEquipmentAsync(request);
        return Ok(ApiResponse<object>.Ok(result));
    }
}
