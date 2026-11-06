using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Application.Member.Responses;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Member.Services;

/// <summary>A member's profile photo and documents (ARCH-023).</summary>
public class MemberFilesService(ICurrentUser currentUser, IAppDbContext db, IFileStorage storage)
{
    /// <summary>
    /// Loads a member the caller may act on (see <see cref="MemberScope"/>): clients only
    /// themselves, trainers only their assigned clients, super admin accounts only by a
    /// super admin. Throws (→ 403) otherwise; null when not found in the caller's gym.
    /// </summary>
    private Task<User?> GetAccessibleAsync(ulong id) => db.GetActionableUserAsync(currentUser, id);

    public async Task<string> UploadPhotoAsync(ulong id, FileUpload photo)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return string.Empty;
        var url = await storage.SaveAsync(photo, $"tenants/{user.TenantId}/members/{id}/photo",
            FileKind.Image);
        var previous = user.AvatarUrl;
        user.AvatarUrl = url;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveMemberAsync(user);
        await storage.DeleteAsync(previous);
        return url;
    }

    public async Task<List<MemberDocumentResponse>> GetDocumentsAsync(ulong id)
    {
        if (await GetAccessibleAsync(id) is null) return [];
        var docs = await db.MediaLibraries
            .Where(m => m.UploadedBy == id || (m.Tags != null && EF.Functions.Like(m.Tags.RootElement.ToString(), $"%memberId:{id}%")))
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();

        return docs.Select(m => new MemberDocumentResponse
        {
            Id = m.Id,
            FileName = m.Name,
            Url = m.FileUrl,
            DocumentType = m.FileType,
            UploadedAt = m.CreatedAt
        }).ToList();
    }

    public async Task<MemberDocumentResponse> UploadDocumentAsync(ulong id, FileUpload file, string? documentType)
    {
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");
        var tenantId = member.TenantId;
        var url = await storage.SaveAsync(file, $"tenants/{tenantId}/members/{id}/documents",
            FileKind.Document);
        // Shown in lists only; keep it short and free of path characters.
        var displayName = Path.GetFileName(file.FileName ?? "document");
        if (displayName.Length > 120) displayName = displayName[..120];

        var media = new MediaLibrary
        {
            TenantId = tenantId,
            UploadedBy = id,
            Name = displayName,
            FileUrl = url,
            FileType = documentType,
            MimeType = file.ContentType,
            FileSize = (uint)file.Length,
            Tags = JsonDocument.Parse(JsonSerializer.Serialize(new { memberId = id, documentType })),
            CreatedAt = DateTime.UtcNow
        };
        db.MediaLibraries.Add(media);
        await db.SaveChangesAsync();

        return new MemberDocumentResponse
        {
            Id = media.Id, FileName = media.Name,
            Url = media.FileUrl, DocumentType = documentType,
            UploadedAt = media.CreatedAt
        };
    }
}
