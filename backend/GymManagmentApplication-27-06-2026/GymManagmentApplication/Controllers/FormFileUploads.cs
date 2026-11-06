using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Controllers;

/// <summary>
/// Adapts ASP.NET's <see cref="IFormFile"/> to the Application layer's <see cref="FileUpload"/>
/// (ARCH-097): HTTP types stop at the controllers.
/// </summary>
public static class FormFileUploads
{
    /// <summary>
    /// A missing file stays null, so the service's own "choose a file" validation still answers
    /// exactly as before.
    /// </summary>
    public static FileUpload ToUpload(this IFormFile? file) =>
        file is null ? null! : new(file.FileName, file.ContentType, file.Length, file.OpenReadStream);

    public static FileUpload? ToUploadOrNull(this IFormFile? file) =>
        file is null ? null : new(file.FileName, file.ContentType, file.Length, file.OpenReadStream);
}
