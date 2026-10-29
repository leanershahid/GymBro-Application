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
    AppDbContext db,
    GymManagmentApplication.Infrastructure.Storage.IFileStorage storage) : IMemberService
{
    /// <summary>
    /// Loads a member the caller may act on (see <see cref="MemberScope"/>): clients only
    /// themselves, trainers only their assigned clients, super admin accounts only by a
    /// super admin. Throws (→ 403) otherwise; null when not found in the caller's gym.
    /// </summary>
    private Task<User?> GetAccessibleAsync(ulong id) => db.GetActionableUserAsync(currentUser, id);

    public async Task<PagedResponse<MemberResponse>> GetAllAsync(MemberSearchRequest request)
    {
        // Trainers list only the clients assigned to them.
        var onlyAssignedTo = currentUser.IsTrainer() ? currentUser.UserId : null;
        var (items, total) = await repository.GetAllAsync(request, onlyAssignedTo);
        var needsReassignment = await NeedsReassignmentSetAsync();
        return new PagedResponse<MemberResponse>
        {
            Items = items.Select(u => MapWithFlags(u, needsReassignment)),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    /// <summary>
    /// Client ids whose trainer relationship was paused by a trainer removal/deactivation
    /// and who haven't been given a new active trainer since.
    /// </summary>
    private async Task<HashSet<ulong>> NeedsReassignmentSetAsync()
    {
        var paused = await db.TrainerClientAssignments
            .Where(a => a.Status == TrainerAssignmentStatus.Paused)
            .Select(a => a.ClientId)
            .Distinct()
            .ToListAsync();
        if (paused.Count == 0) return [];

        var reassigned = await db.TrainerClientAssignments
            .Where(a => a.Status == TrainerAssignmentStatus.Active && paused.Contains(a.ClientId))
            .Select(a => a.ClientId)
            .ToListAsync();

        return paused.Except(reassigned).ToHashSet();
    }

    public async Task<MemberResponse> CreateAsync(CreateMemberRequest request)
    {
        // Capitalise first letter of first name and build default password: John@123
        var firstName = string.IsNullOrWhiteSpace(request.FirstName)
            ? "Member"
            : char.ToUpper(request.FirstName[0]) + request.FirstName[1..].ToLower();

        // Default password, returned once so staff can hand it over: John@123
        var defaultPassword = $"{firstName}@123";
        var tenantId = currentUser.ResolveTenantId(request.TenantId);

        // Home branch: explicit, else the chosen trainer's branch.
        var branchId = request.BranchId;
        if (branchId is null && request.TrainerId is { } tid)
            branchId = (await db.TrainerProfiles.FirstOrDefaultAsync(t => t.Id == tid))?.BranchId;

        // Joins an outer transaction (bulk import) when there is one.
        await using var tx = db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync() : null;

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

        if (tx is not null) await tx.CommitAsync();
        return response;
    }

    public async Task<MemberResponse?> GetByIdAsync(ulong id)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return null;
        var needsReassignment = await NeedsReassignmentSetAsync();
        return MapWithFlags(user, needsReassignment);
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
        if (request.Notes is not null && !currentUser.IsClient()) user.Notes = request.Notes;
        if (request.FirstName is not null) user.FirstName = request.FirstName;
        if (request.LastName is not null) user.LastName = request.LastName;
        if (request.Phone is not null) user.Phone = request.Phone;
        if (request.Dob.HasValue) user.Dob = request.Dob;
        if (request.AvatarUrl is not null) user.AvatarUrl = request.AvatarUrl;
        if (request.Gender is not null) user.Gender = Enum.TryParse<UserGender>(request.Gender, true, out var g) ? g : user.Gender;
        await repository.UpdateAsync(user);
        return Map(user);
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        if (await GetAccessibleAsync(id) is null) return false;
        if (id == currentUser.UserId)
            throw new ArgumentException("You cannot archive your own account.");
        var deleted = await repository.SoftDeleteAsync(id);
        if (deleted) await AuthSessions.RevokeAllAsync(db, id); // signed-in sessions end at next request
        return deleted;
    }

    public async Task<bool> SetStatusAsync(ulong id, bool isActive)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return false;
        if (id == currentUser.UserId)
            throw new ArgumentException("You cannot deactivate your own account.");
        user.Status = isActive ? UserStatus.Active : UserStatus.Inactive;
        await repository.UpdateAsync(user);
        if (!isActive) await AuthSessions.RevokeAllAsync(db, id);
        return true;
    }

    private const int BulkImportLimit = 500;

    public async Task<List<MemberResponse>> BulkImportAsync(BulkImportMemberRequest request)
    {
        if (request.Members.Count > BulkImportLimit)
            throw new ArgumentException($"Import at most {BulkImportLimit} members at a time.");
        // All or nothing: a bad row rolls back the rows before it.
        await using var tx = await db.Database.BeginTransactionAsync();
        var results = new List<MemberResponse>();
        foreach (var r in request.Members)
            results.Add(await CreateAsync(r));
        await tx.CommitAsync();
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
        var url = await storage.SaveAsync(photo, $"tenants/{user.TenantId}/members/{id}/photo",
            GymManagmentApplication.Infrastructure.Storage.FileKind.Image);
        var previous = user.AvatarUrl;
        user.AvatarUrl = url;
        user.UpdatedAt = DateTime.UtcNow;
        await repository.UpdateAsync(user);
        await storage.DeleteAsync(previous);
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
        var url = await storage.SaveAsync(file, $"tenants/{tenantId}/members/{id}/documents",
            GymManagmentApplication.Infrastructure.Storage.FileKind.Document);
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

    private static MemberResponse MapWithFlags(User u, HashSet<ulong> needsReassignment)
    {
        var r = Map(u);
        r.NeedsNewTrainer = needsReassignment.Contains(u.Id);
        return r;
    }

    private static MemberResponse Map(User u) => new()
    {
        Id = u.Id,
        TenantId = u.TenantId,
        BranchId = u.BranchId,
        BranchName = u.Branch?.Name,
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
