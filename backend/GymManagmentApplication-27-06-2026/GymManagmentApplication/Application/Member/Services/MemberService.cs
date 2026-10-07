using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
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
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Member;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Member.Services;

public class MemberService(
    IMemberRepository repository,
    ITrainerService trainerService,
    IAuthService authService,
    ICurrentUser currentUser,
    AppDbContext db) : IMemberService
{
    /// <summary>
    /// Loads a member the caller may see. Queries are already tenant-filtered; on top of
    /// that a client may only touch their own record. Throws (→ 403) for someone else's.
    /// </summary>
    private async Task<User?> GetAccessibleAsync(ulong id)
    {
        if (currentUser.Role == RoleNames.Client && currentUser.UserId != id)
            throw new UnauthorizedAccessException("You can only access your own member profile.");
        return await repository.GetByIdAsync(id);
    }

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

        // Random one-time password, returned once so staff can hand it over.
        var defaultPassword = PasswordHasher.GenerateTemporary();
        var tenantId = currentUser.ResolveTenantId(request.TenantId);

        // Home branch: explicit, else the chosen trainer's branch.
        var branchId = request.BranchId;
        if (branchId is null && request.TrainerId is { } tid)
            branchId = (await db.TrainerProfiles.FirstOrDefaultAsync(t => t.Id == tid))?.BranchId;

        await using var tx = await db.Database.BeginTransactionAsync();

        // Creates the User in this tenant/branch with the tenant's own 'client' role
        // (and checks the branch belongs to the tenant).
        var created = await authService.CreateUserAsync(new NewUser(
                tenantId, branchId, RoleNames.Client,
                request.Email, defaultPassword, firstName, request.LastName ?? string.Empty))
            ?? throw new ArgumentException($"Email '{request.Email}' is already registered.");

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

        // Optionally assign to a trainer immediately (same tenant/branch checks apply)
        if (request.TrainerId.HasValue)
        {
            await trainerService.AssignClientAsync(request.TrainerId.Value, new AssignClientRequest
            {
                ClientId = created.Id,
                BranchId = branchId ?? 0,
                Notes    = "Assigned during member creation"
            });
            response.TrainerId = request.TrainerId;
        }

        await tx.CommitAsync();
        return response;
    }

    public async Task<MemberResponse?> GetByIdAsync(ulong id)
    {
        var user = await GetAccessibleAsync(id);
        return user is null ? null : Map(user);
    }

    public async Task<MemberResponse?> UpdateAsync(ulong id, UpdateMemberRequest request)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return null;
        if (request.BranchId is { } newBranch && newBranch != user.BranchId)
        {
            if (!currentUser.IsAdmin && !currentUser.IsDelegatedRole)
                throw new UnauthorizedAccessException("Only an admin can move a member to another branch.");
            if (!await db.Branches.AnyAsync(b => b.Id == newBranch && b.TenantId == user.TenantId))
                throw new ArgumentException($"Branch {newBranch} does not belong to this gym.");
            user.BranchId = newBranch;
        }
        if (request.Notes is not null && currentUser.Role != RoleNames.Client) user.Notes = request.Notes;
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
        var user = await GetAccessibleAsync(id);
        if (user is null) return [];
        return
        [
            new() { EventType = "Created", Description = "Member profile created.", OccurredAt = user.CreatedAt }
        ];
    }

    public async Task<string> UploadPhotoAsync(ulong id, IFormFile photo)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return string.Empty;
        var url = $"/uploads/members/{id}/{photo.FileName}";
        user.AvatarUrl = url;
        await repository.UpdateAsync(user);
        return url;
    }

    public async Task<List<MemberNoteResponse>> GetNotesAsync(ulong id)
    {
        var member = await GetAccessibleAsync(id);
        if (member is null) return [];
        var notes = await db.AuditLogs
            .Where(a => a.EntityType == "MemberNote" && a.EntityId == id && a.TenantId == member.TenantId)
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
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");
        var authorId = currentUser.UserId ?? 0;
        var entry = new AuditLog
        {
            TenantId = member.TenantId,
            EntityType = "MemberNote",
            EntityId = id,
            Action = "create",
            UserId = authorId,
            NewValues = JsonDocument.Parse(JsonSerializer.Serialize(new { note = request.Note })),
            CreatedAt = DateTime.UtcNow
        };
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync();

        return new MemberNoteResponse { Id = entry.Id, Note = request.Note, TrainerId = authorId, CreatedAt = entry.CreatedAt };
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

    public async Task<MemberDocumentResponse> UploadDocumentAsync(ulong id, IFormFile file, string? documentType)
    {
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");
        var tenantId = member.TenantId;
        var url = $"/uploads/members/{id}/docs/{file.FileName}";

        var media = new MediaLibrary
        {
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
        if (await GetAccessibleAsync(id) is null) return [];
        return await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .Include(t => t.Tag)
            .Select(t => t.Tag.Name)
            .ToListAsync();
    }

    public async Task<bool> AssignTagsAsync(ulong id, AssignTagsRequest request)
    {
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");

        // Remove existing tags for this member
        var existing = await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .ToListAsync();
        db.Taggables.RemoveRange(existing);

        var tenantId = member.TenantId;

        foreach (var tagName in request.Tags)
        {
            // Get or create the tag
            var tag = await db.Tags.FirstOrDefaultAsync(t => t.TenantId == tenantId && t.Name == tagName);
            if (tag is null)
            {
                tag = new Tag { TenantId = tenantId, Name = tagName };
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
        BranchId = u.BranchId,
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
