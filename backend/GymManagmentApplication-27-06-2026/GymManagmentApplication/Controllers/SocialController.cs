using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Social;
using GymManagmentApplication.Filters;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// The social feed: image posts, likes and comments. The caller is always the signed-in user
/// (from the JWT) and only sees their own gym's posts. Validation errors answer 400, unknown or
/// hidden records 404, and "not yours" 403 through the global exception middleware.
/// </summary>
[ApiController]
[Route("api/social")]
[AuthorizeRoles]
[RequireModule("social")]
public class SocialController(ISocialPostService posts, ISocialLikeService likes, ISocialCommentService comments) : ControllerBase
{
    // ── Posts ─────────────────────────────────────────────────────────────

    /// <summary>Newest first. Pass the previous page's <c>nextCursor</c> as <c>cursor</c> for older posts.</summary>
    [HttpGet("posts")]
    public async Task<ActionResult<ApiResponse<object>>> GetFeed([FromQuery] ulong? cursor, [FromQuery] int pageSize = 10)
        => Ok(ApiResponse<object>.Ok(await posts.GetFeedAsync(cursor, pageSize)));

    [HttpGet("posts/{postId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> GetPost(ulong postId)
        => Ok(ApiResponse<object>.Ok(await posts.GetAsync(postId)));

    /// <summary>multipart/form-data: <c>caption</c> (optional) and one or more <c>images</c> files.</summary>
    [HttpPost("posts")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(64L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 64L * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> CreatePost([FromForm] string? caption, [FromForm] List<IFormFile> images)
    {
        var created = await posts.CreateAsync(caption, images);
        return StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(created, "Post published."));
    }

    [HttpDelete("posts/{postId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> DeletePost(ulong postId)
    {
        await posts.DeleteAsync(postId);
        return Ok(ApiResponse<object>.Ok((object)null!, "Post deleted."));
    }

    // ── Likes ─────────────────────────────────────────────────────────────

    /// <summary>Idempotent: liking an already-liked post just returns the current state.</summary>
    [HttpPost("posts/{postId:long}/like")]
    public async Task<ActionResult<ApiResponse<object>>> Like(ulong postId)
        => Ok(ApiResponse<object>.Ok(await likes.LikeAsync(postId)));

    [HttpDelete("posts/{postId:long}/like")]
    public async Task<ActionResult<ApiResponse<object>>> Unlike(ulong postId)
        => Ok(ApiResponse<object>.Ok(await likes.UnlikeAsync(postId)));

    // ── Comments ──────────────────────────────────────────────────────────

    /// <summary>Oldest first, paged at the database.</summary>
    [HttpGet("posts/{postId:long}/comments")]
    public async Task<ActionResult<ApiResponse<object>>> GetComments(ulong postId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 20)
        => Ok(ApiResponse<object>.Ok(await comments.ListAsync(postId, pageNumber, pageSize)));

    [HttpPost("posts/{postId:long}/comments")]
    public async Task<ActionResult<ApiResponse<object>>> AddComment(ulong postId, [FromBody] SocialCommentRequest request)
        => StatusCode(StatusCodes.Status201Created, ApiResponse<object>.Ok(await comments.AddAsync(postId, request.Text), "Comment added."));

    [HttpPut("comments/{commentId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateComment(ulong commentId, [FromBody] SocialCommentRequest request)
        => Ok(ApiResponse<object>.Ok(await comments.UpdateAsync(commentId, request.Text), "Comment updated."));

    [HttpDelete("comments/{commentId:long}")]
    public async Task<ActionResult<ApiResponse<object>>> DeleteComment(ulong commentId)
    {
        await comments.DeleteAsync(commentId);
        return Ok(ApiResponse<object>.Ok((object)null!, "Comment deleted."));
    }
}
