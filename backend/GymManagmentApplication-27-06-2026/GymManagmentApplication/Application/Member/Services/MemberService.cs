using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Application.Member.Responses;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Member;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Member.Services;

public class MemberService(IMemberRepository repository, ITrainerService trainerService, IAuthService authService, AppDbContext db) : IMemberService
{

    public async Task<PagedResponse<MemberResponse>> GetAllAsync(MemberSearchRequest request)
    {
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<MemberResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<MemberResponse> CreateAsync(CreateMemberRequest request)
    {
        // Capitalise first letter of first name and build default password: John@123
        var firstName = string.IsNullOrWhiteSpace(request.FirstName)
            ? "Member"
            : char.ToUpper(request.FirstName[0]) + request.FirstName[1..].ToLower();

        var defaultPassword = $"{firstName}@123";

        // Register through AuthService so the User row is created with a
        // proper hashed password, resolved TenantId, and 'client' role.
        var authResult = await authService.RegisterAsync(new RegisterRequest
        {
            Email     = request.Email,
            Password  = defaultPassword,
            FirstName = firstName,
            LastName  = request.LastName ?? string.Empty,
            TenantId  = request.TenantId
        });

        // authResult is null only when email already exists
        if (authResult is null)
            throw new InvalidOperationException($"Email '{request.Email}' is already registered.");

        // Fetch the newly created User to fill remaining profile fields
        var created = await repository.GetByEmailAsync(request.Email)
                      ?? throw new InvalidOperationException("User was registered but could not be retrieved.");

        // Patch profile fields that RegisterRequest doesn't cover
        if (request.Phone is not null)     created.Phone = request.Phone;
        if (request.Dob.HasValue)          created.Dob = request.Dob;
        if (request.AvatarUrl is not null) created.AvatarUrl = request.AvatarUrl;
        if (request.Notes is not null)     created.Notes = request.Notes;
        if (request.Gender is not null && Enum.TryParse<UserGender>(request.Gender, true, out var g))
            created.Gender = g;
        created.Status = UserStatus.Active;
        await repository.UpdateAsync(created);

        var response = Map(created);
        response.DefaultPassword = defaultPassword; // surface once so admin can share it

        // Optionally assign to a trainer immediately
        if (request.TrainerId.HasValue)
        {
            await trainerService.AssignClientAsync(request.TrainerId.Value, new AssignClientRequest
            {
                ClientId = created.Id,
                BranchId = request.BranchId ?? 0,
                Notes    = "Assigned during member creation"
            });
            response.TrainerId = request.TrainerId;
            response.BranchId  = request.BranchId;
        }

        return response;
    }

    public async Task<MemberResponse?> GetByIdAsync(ulong id)
    {
        var user = await repository.GetByIdAsync(id);
        return user is null ? null : Map(user);
    }

    public async Task<MemberResponse?> UpdateAsync(ulong id, UpdateMemberRequest request)
    {
        var user = await repository.GetByIdAsync(id);
        if (user is null) return null;
        if (request.FirstName is not null) user.FirstName = request.FirstName;
        if (request.LastName is not null) user.LastName = request.LastName;
        if (request.Phone is not null) user.Phone = request.Phone;
        if (request.Dob.HasValue) user.Dob = request.Dob;
        if (request.AvatarUrl is not null) user.AvatarUrl = request.AvatarUrl;
        if (request.Gender is not null) user.Gender = Enum.TryParse<UserGender>(request.Gender, true, out var g) ? g : user.Gender;
        await repository.UpdateAsync(user);
        return Map(user);
    }

    public Task<bool> DeleteAsync(ulong id) => repository.SoftDeleteAsync(id);

    public async Task<List<MemberResponse>> BulkImportAsync(BulkImportMemberRequest request)
    {
        var results = new List<MemberResponse>();
        foreach (var r in request.Members)
            results.Add(await CreateAsync(r));
        return results;
    }

    public async Task<List<MemberTimelineResponse>> GetTimelineAsync(ulong id)
    {
        var user = await repository.GetByIdAsync(id);
        if (user is null) return [];
        return
        [
            new() { EventType = "Created", Description = "Member profile created.", OccurredAt = user.CreatedAt }
        ];
    }

    public async Task<string> UploadPhotoAsync(ulong id, IFormFile photo)
    {
        var user = await repository.GetByIdAsync(id);
        if (user is null) return string.Empty;
        var url = $"/uploads/members/{id}/{photo.FileName}";
        user.AvatarUrl = url;
        await repository.UpdateAsync(user);
        return url;
    }

    public async Task<List<MemberNoteResponse>> GetNotesAsync(ulong id)
    {
        var notes = await db.AuditLogs
            .Where(a => a.EntityType == "MemberNote" && a.EntityId == id)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return notes.Select(a => new MemberNoteResponse
        {
            Id = a.Id,
            Note = a.NewValues != null
                ? a.NewValues.RootElement.GetProperty("note").GetString() ?? string.Empty
                : string.Empty,
            TrainerId =(ulong) a.UserId,
            CreatedAt = a.CreatedAt
        }).ToList();
    }

    public async Task<MemberNoteResponse> AddNoteAsync(ulong id, AddMemberNoteRequest request)
    {
        var maxId = await db.AuditLogs.MaxAsync(a => (ulong?)a.Id) ?? 0;
        var entry = new AuditLog
        {
            Id = maxId + 1,
            EntityType = "MemberNote",
            EntityId = id,
            Action = "create",
            UserId = request.TrainerId,
            NewValues = JsonDocument.Parse(JsonSerializer.Serialize(new { note = request.Note })),
            CreatedAt = DateTime.UtcNow
        };
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync();

        return new MemberNoteResponse { Id = entry.Id, Note = request.Note, TrainerId = request.TrainerId, CreatedAt = entry.CreatedAt };
    }

    public async Task<List<MemberDocumentResponse>> GetDocumentsAsync(ulong id)
    {
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

    public async Task<MemberDocumentResponse> UploadDocumentAsync(ulong id, IFormFile file, string? documentType)
    {
        var tenantId = (await db.Users.FindAsync(id))?.TenantId ?? 0;
        var maxId = await db.MediaLibraries.MaxAsync(m => (ulong?)m.Id) ?? 0;
        var url = $"/uploads/members/{id}/docs/{file.FileName}";

        var media = new MediaLibrary
        {
            Id = maxId + 1,
            TenantId = tenantId,
            UploadedBy = id,
            Name = file.FileName,
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

    public Task<PagedResponse<MemberResponse>> SearchAsync(MemberSearchRequest request) => GetAllAsync(request);

    public async Task<List<string>> GetTagsAsync(ulong id)
    {
        return await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .Include(t => t.Tag)
            .Select(t => t.Tag.Name)
            .ToListAsync();
    }

    public async Task<bool> AssignTagsAsync(ulong id, AssignTagsRequest request)
    {
        // Remove existing tags for this member
        var existing = await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .ToListAsync();
        db.Taggables.RemoveRange(existing);

        var tenantId = (await db.Users.FindAsync(id))?.TenantId ?? 0;

        foreach (var tagName in request.Tags)
        {
            // Get or create the tag
            var tag = await db.Tags.FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Name == tagName);
            if (tag is null)
            {
                var maxTagId = await db.Tags.MaxAsync(t => (ulong?)t.Id) ?? 0;
                tag = new Tag { Id = maxTagId + 1, TenantId = tenantId, Name = tagName };
                db.Tags.Add(tag);
                await db.SaveChangesAsync();
            }
            db.Taggables.Add(new Taggable { TagId = tag.Id, TaggableId = id, TaggableType = "User" });
        }

        await db.SaveChangesAsync();
        return true;
    }

    private static MemberResponse Map(User u) => new()
    {
        Id = u.Id,
        TenantId = u.TenantId,
        Email = u.Email,
        FirstName = u.FirstName,
        LastName = u.LastName,
        Phone = u.Phone,
        Gender = u.Gender?.ToString(),
        Dob = u.Dob,
        AvatarUrl = u.AvatarUrl,
        Status = u.Status.ToString(),
        CreatedAt = u.CreatedAt
    };
}
