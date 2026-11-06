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

/// <summary>
/// Member records: list/search, create (single and bulk), profile updates, archive and status
/// (ARCH-023, split out of the former MemberService).
/// </summary>
public class MemberDirectoryService(
    ITrainerService trainerService,
    IAuthService authService,
    ICurrentUser currentUser,
    IAppDbContext db)
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
        var (items, total) = await db.SearchMembersAsync(request, onlyAssignedTo);
        var needsReassignment = await NeedsReassignmentSetAsync();
        var trainers = await ActiveTrainerMapAsync(items.Select(u => u.Id));
        return new PagedResponse<MemberResponse>
        {
            Items = items.Select(u => WithTrainer(MapWithFlags(u, needsReassignment), trainers)),
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

        // ARCH-044: emails are stored trimmed and lower-cased, so the unique index is effectively case-insensitive.
        request.Email = EmailAddress.Normalize(request.Email)!;

        // ARCH-045: one transaction for user + profile + trainer assignment; joins an outer one (bulk import).
        return await db.InTransactionAsync(() => CreateInTransactionAsync(request, firstName, defaultPassword, tenantId, branchId));
    }

    private async Task<MemberResponse> CreateInTransactionAsync(CreateMemberRequest request, string firstName,
        string defaultPassword, ulong tenantId, ulong? branchId)
    {
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
        await db.SaveMemberAsync(created);

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

        return response;
    }

    public async Task<MemberResponse?> GetByIdAsync(ulong id)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return null;
        var needsReassignment = await NeedsReassignmentSetAsync();
        return WithTrainer(MapWithFlags(user, needsReassignment), await ActiveTrainerMapAsync([user.Id]));
    }

    /// <summary>Member id → their active trainer's profile id.</summary>
    private async Task<Dictionary<ulong, ulong>> ActiveTrainerMapAsync(IEnumerable<ulong> memberIds)
    {
        var ids = memberIds.ToList();
        if (ids.Count == 0) return [];
        var rows = await db.TrainerClientAssignments
            .Where(a => ids.Contains(a.ClientId) && a.Status == TrainerAssignmentStatus.Active)
            .OrderByDescending(a => a.Id)
            .Select(a => new { a.ClientId, a.TrainerId })
            .ToListAsync();
        return rows.GroupBy(r => r.ClientId).ToDictionary(g => g.Key, g => g.First().TrainerId);
    }

    private static MemberResponse WithTrainer(MemberResponse r, Dictionary<ulong, ulong> trainers)
    {
        if (trainers.TryGetValue(r.Id, out var t)) r.TrainerId = t;
        return r;
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
        await db.SaveMemberAsync(user);
        return Map(user);
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        if (await GetAccessibleAsync(id) is null) return false;
        if (id == currentUser.UserId)
            throw new ArgumentException("You cannot archive your own account.");
        // ARCH-045: archive + session revocation commit together.
        return await db.InTransactionAsync(async () =>
        {
            var deleted = await db.SoftDeleteMemberAsync(id);
            if (deleted) await AuthSessions.RevokeAllAsync(db, id); // signed-in sessions end at next request
            return deleted;
        });
    }

    public async Task<bool> SetStatusAsync(ulong id, bool isActive)
    {
        var user = await GetAccessibleAsync(id);
        if (user is null) return false;
        if (id == currentUser.UserId)
            throw new ArgumentException("You cannot deactivate your own account.");
        user.Status = isActive ? UserStatus.Active : UserStatus.Inactive;
        await db.InTransactionAsync(async () =>
        {
            await db.SaveMemberAsync(user);
            if (!isActive) await AuthSessions.RevokeAllAsync(db, id);
        });
        return true;
    }

    private const int BulkImportLimit = 500;

    public async Task<List<MemberResponse>> BulkImportAsync(BulkImportMemberRequest request)
    {
        if (request.Members.Count > BulkImportLimit)
            throw new ArgumentException($"Import at most {BulkImportLimit} members at a time.");
        // All or nothing: a bad row rolls back the rows before it.
        return await db.InTransactionAsync(async () =>
        {
            var results = new List<MemberResponse>();
            foreach (var r in request.Members)
                results.Add(await CreateAsync(r));
            return results;
        });
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

    public Task<PagedResponse<MemberResponse>> SearchAsync(MemberSearchRequest request) => GetAllAsync(request);

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
