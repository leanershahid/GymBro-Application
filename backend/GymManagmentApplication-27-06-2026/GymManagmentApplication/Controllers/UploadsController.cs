using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Http;
using GymManagmentApplication.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Uploads one file and returns its URL, for forms whose image or document field is a URL
/// (gym and branch logos, trainer photos and certificates). Files go wherever storage is set up —
/// Cloudinary in production — under a folder per gym. The file type is checked from its content
/// (magic bytes), uploads are rate-limited per user, and videos are for staff only.
/// </summary>
[ApiController]
[Route("api/uploads")]
[AuthorizeRoles]
public class UploadsController(IFileStorage storage, ICurrentUser currentUser) : ControllerBase
{
    private static readonly HashSet<string> Folders = ["logos", "avatars", "documents", "media"];

    /// <param name="kind">"image" (default), "document" (PDF or image) or "video" (staff only, not members).</param>
    /// <param name="folder">"logos", "avatars", "documents" or "media".</param>
    [HttpPost]
    [EnableRateLimiting(RateLimits.Uploads)]
    [RequestSizeLimit(110 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 110 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> Upload(IFormFile file, [FromQuery] string kind = "image", [FromQuery] string folder = "media")
    {
        var fileKind = kind.ToLowerInvariant() switch
        {
            "document" => FileKind.Document,
            "video" => FileKind.Video,
            _ => FileKind.Image,
        };
        if (fileKind == FileKind.Video && currentUser.Role.Equals(RoleNames.Client, StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<object>.Fail("Only staff can upload videos."));
        if (!Folders.Contains(folder)) folder = "media";
        var tenant = currentUser.TenantId?.ToString() ?? "shared";

        var url = await storage.SaveAsync(file.ToUpload(), $"tenant-{tenant}/{folder}", fileKind);
        return Ok(ApiResponse<object>.Ok(new { url }, "Uploaded."));
    }

    /// <summary>
    /// A URL that opens a stored file. For private documents (Storage:PrivateDocuments) it is a signed,
    /// short-lived link; public files come back unchanged. Only files of the caller's own gym.
    /// </summary>
    [HttpGet("signed-url")]
    public async Task<ActionResult<ApiResponse<object>>> SignedUrl([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return BadRequest(ApiResponse<object>.Fail("url is required."));
        if (!currentUser.IsSuperAdmin)
        {
            var tenant = currentUser.TenantId?.ToString();
            var ownGym = tenant is not null &&
                         (url.Contains($"/tenant-{tenant}/", StringComparison.Ordinal) ||
                          url.Contains($"/tenants/{tenant}/", StringComparison.Ordinal));
            if (!ownGym) return NotFound(ApiResponse<object>.Fail("File not found."));
        }
        return Ok(ApiResponse<object>.Ok(new { url = await storage.GetSignedUrlAsync(url) }));
    }
}
