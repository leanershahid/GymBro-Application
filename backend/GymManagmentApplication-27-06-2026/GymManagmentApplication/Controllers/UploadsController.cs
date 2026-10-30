using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Filters;
using GymManagmentApplication.Infrastructure.Storage;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Uploads one file and returns its public URL, for forms whose image or document field is a URL
/// (gym and branch logos, trainer photos and certificates). Files go wherever storage is set up —
/// Cloudinary in production — under a folder per gym.
/// </summary>
[ApiController]
[Route("api/uploads")]
public class UploadsController(IFileStorage storage, ICurrentUser currentUser) : ControllerBase
{
    private static readonly HashSet<string> Folders = ["logos", "avatars", "documents", "media"];

    /// <param name="kind">"image" (default), "document" (PDF or image) or "video".</param>
    /// <param name="folder">"logos", "avatars", "documents" or "media".</param>
    [HttpPost]
    [AuthorizeRoles]
    [RequestSizeLimit(110 * 1024 * 1024)]
    public async Task<ActionResult<ApiResponse<object>>> Upload(IFormFile file, [FromQuery] string kind = "image", [FromQuery] string folder = "media")
    {
        var fileKind = kind.ToLowerInvariant() switch
        {
            "document" => FileKind.Document,
            "video" => FileKind.Video,
            _ => FileKind.Image,
        };
        if (!Folders.Contains(folder)) folder = "media";
        var tenant = currentUser.TenantId?.ToString() ?? "shared";

        var url = await storage.SaveAsync(file, $"tenant-{tenant}/{folder}", fileKind);
        return Ok(ApiResponse<object>.Ok(new { url }, "Uploaded."));
    }
}
