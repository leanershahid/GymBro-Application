using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Application.Trainer.Responses;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Trainer.Services;

public class TrainerService(
    ITrainerRepository repository,
    IAuthService authService,
    ICurrentUser currentUser,
    AppDbContext db,
    GymManagmentApplication.Application.Scheduling.PtService pt) : ITrainerService
{
    private static readonly JsonSerializerOptions _opts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task<PagedResponse<TrainerResponse>> GetAllAsync(int pageNumber, int pageSize, string? search = null)
    {
        var (items, total) = await repository.GetAllAsync(pageNumber, pageSize, search);
        return new PagedResponse<TrainerResponse>
        {
            Items = items.Select(MapToResponse).Select(ForCaller),
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalRecords = total
        };
    }

    public async Task<TrainerResponse> CreateAsync(CreateTrainerRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);

        // Capitalise first letter of first name and build default password: John@123
        var firstWord = request.DisplayName?.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        var firstName = string.IsNullOrWhiteSpace(firstWord)
            ? "Trainer"
            : char.ToUpper(firstWord[0]) + firstWord[1..].ToLower();
        var temporaryPassword = $"{firstName}@123";

        await using var tx = await db.Database.BeginTransactionAsync();

        // Creates the login in the right tenant + branch with that tenant's 'trainer' role,
        // and verifies the branch belongs to the tenant.
        var createdUser = await authService.CreateUserAsync(new NewUser(
            tenantId, request.BranchId, RoleNames.Trainer,
            request.Email!, temporaryPassword, request.DisplayName, null))
            ?? throw new ArgumentException($"Email '{request.Email}' is already registered.");
        createdUser.Phone = request.Phone;

        var trainer = new TrainerProfile
        {
            TenantId = tenantId,
            UserId = createdUser.Id,
            BranchId = request.BranchId,
            TrainerCode = request.TrainerCode,
            DisplayName = request.DisplayName,
            ProfileImage = request.ProfileImage,
            Bio = request.Bio,
            ExperienceYears = request.ExperienceYears,
            Gender = request.Gender,
            DateOfBirth = request.DateOfBirth,
            Phone = request.Phone,
            Email = request.Email,
            Address = request.Address,
            Notes = request.Notes,
            LanguagesKnown = ToJson(request.LanguagesKnown),
            Specializations = ToJson(request.Specializations),
            Certifications = ToJson(request.Certifications),
            Employment = ToJson(request.Employment),
            Salary = ToJson(request.Salary),
            Allowances = ToJson(request.Allowances),
            Deductions = ToJson(request.Deductions),
            PaymentDetails = ToJson(request.PaymentDetails),
            Availability = ToJson(request.Availability),
            BookingSettings = ToJson(request.BookingSettings),
            CommissionSettings = ToJson(request.CommissionSettings),
            AttendanceSettings = ToJson(request.AttendanceSettings),
            Documents = ToJson(request.Documents),
            EmergencyContact = ToJson(request.EmergencyContact),
            SocialLinks = ToJson(request.SocialLinks),
        };
        var created = await repository.CreateAsync(trainer);
        await tx.CommitAsync();

        var response = MapToResponse(created);
        response.TemporaryPassword = temporaryPassword; // shown once so the admin can share it
        return response;
    }

    public async Task<TrainerResponse?> GetByUserIdAsync(ulong userId)
    {
        var trainer = await repository.GetByUserIdAsync(userId);
        return trainer is null ? null : MapToResponse(trainer);
    }

    /// <summary>
    /// Admins may act on any trainer in their gym; a trainer only on their own profile.
    /// Throws (→ 403) otherwise. Returns the profile (tenant-filtered) or null.
    /// </summary>
    private async Task<TrainerProfile?> GetForWriteAsync(ulong trainerId)
    {
        var trainer = await repository.GetByIdAsync(trainerId);
        if (trainer is null) return null;
        if (!currentUser.IsAdmin && !currentUser.IsDelegatedRole && trainer.UserId != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only manage your own trainer profile.");
        return trainer;
    }

    public async Task<TrainerResponse?> GetByIdAsync(ulong id)
    {
        var trainer = await repository.GetByIdAsync(id);
        return trainer is null ? null : ForCaller(MapToResponse(trainer));
    }

    /// <summary>
    /// HR, pay and personal fields are visible only to admins/staff and to the trainer
    /// themselves. Clients and other trainers get the public profile.
    /// </summary>
    private TrainerResponse ForCaller(TrainerResponse r)
    {
        if (currentUser.IsAdmin || currentUser.IsDelegatedRole || r.UserId == currentUser.UserId) return r;
        r.Salary = null; r.Allowances = null; r.Deductions = null; r.PaymentDetails = null;
        r.Employment = null; r.CommissionSettings = null; r.AttendanceSettings = null;
        r.Documents = null; r.EmergencyContact = null; r.DateOfBirth = null;
        r.Address = null; r.Notes = null; r.Phone = null;
        return r;
    }

    public async Task<TrainerResponse?> UpdateAsync(ulong id, UpdateTrainerRequest request)
    {
        var trainer = await GetForWriteAsync(id);
        if (trainer is null) return null;
        if (request.DisplayName is not null) trainer.DisplayName = request.DisplayName;
        if (request.Bio is not null) trainer.Bio = request.Bio;
        if (request.Phone is not null) trainer.Phone = request.Phone;
        if (request.Email is not null) trainer.Email = request.Email;
        if (request.ProfileImage is not null) trainer.ProfileImage = request.ProfileImage;
        if (request.IsAvailable.HasValue) trainer.IsAvailable = request.IsAvailable.Value;
        await repository.UpdateAsync(trainer);
        return MapToResponse(trainer);
    }

    /// <summary>
    /// Activates/deactivates the trainer's login. Deactivating pauses their active client
    /// assignments (rather than ending them) so admins can see who needs a new trainer and
    /// reassign later without losing the assignment history.
    /// </summary>
    public async Task<bool> SetStatusAsync(ulong id, bool isActive)
    {
        var trainer = await repository.GetByIdAsync(id);
        if (trainer is null) return false;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == trainer.UserId && u.DeletedAt == null);
        if (user is null) return false;

        user.Status = isActive ? UserStatus.Active : UserStatus.Inactive;
        trainer.IsAvailable = isActive;

        if (!isActive)
        {
            var assignments = await db.TrainerClientAssignments
                .Where(a => a.TrainerId == id && a.Status == TrainerAssignmentStatus.Active)
                .ToListAsync();
            foreach (var a in assignments) a.Status = TrainerAssignmentStatus.Paused;
        }

        await db.SaveChangesAsync();
        if (!isActive) await AuthSessions.RevokeAllAsync(db, user.Id);
        return true;
    }

    /// <summary>Removes the trainer (soft-delete) and pauses their active client assignments the same way.</summary>
    public async Task<bool> DeleteAsync(ulong id)
    {
        var trainer = await repository.GetByIdAsync(id);
        if (trainer is null) return false;
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == trainer.UserId && u.DeletedAt == null);
        if (user is null) return false;

        user.DeletedAt = DateTime.UtcNow;
        user.Status = UserStatus.Inactive;
        trainer.IsAvailable = false;

        var assignments = await db.TrainerClientAssignments
            .Where(a => a.TrainerId == id && a.Status == TrainerAssignmentStatus.Active)
            .ToListAsync();
        foreach (var a in assignments) a.Status = TrainerAssignmentStatus.Paused;

        await db.SaveChangesAsync();
        await AuthSessions.RevokeAllAsync(db, user.Id);
        return true;
    }

    public async Task<List<TrainerClientResponse>> GetClientsAsync(ulong id)
    {
        if (await GetForWriteAsync(id) is null) return [];
        var assignments = await repository.GetClientAssignmentsAsync(id);
        return assignments.Select(a => new TrainerClientResponse
        {
            AssignmentId = a.Id,
            ClientId = a.ClientId,
            Status = a.Status.ToString(),
            AssignedAt = a.AssignedAt
        }).ToList();
    }

    public async Task<TrainerClientResponse> AssignClientAsync(ulong id, AssignClientRequest request)
    {
        // All lookups are tenant-filtered, so a trainer/client/branch from another gym is "not found".
        var trainer = await repository.GetByIdAsync(id)
            ?? throw new KeyNotFoundException($"Trainer {id} not found.");

        var client = await db.Users.Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == request.ClientId && u.DeletedAt == null)
            ?? throw new KeyNotFoundException($"Member {request.ClientId} not found.");
        if (client.Role.Slug != RoleNames.Client)
            throw new ArgumentException($"User {request.ClientId} is not a member.");
        if (client.TenantId != trainer.TenantId)
            throw new ArgumentException("Trainer and member belong to different gyms.");

        var branchId = request.BranchId > 0 ? request.BranchId : trainer.BranchId
            ?? throw new ArgumentException("Trainer has no branch; specify BranchId.");
        if (!await db.Branches.AnyAsync(b => b.Id == branchId && b.TenantId == trainer.TenantId))
            throw new ArgumentException($"Branch {branchId} does not belong to this gym.");

        if (await db.TrainerClientAssignments.AnyAsync(a =>
                a.TrainerId == id && a.ClientId == client.Id && a.Status == TrainerAssignmentStatus.Active))
            throw new ArgumentException("This member is already assigned to the trainer.");

        // A member has one active trainer: assigning a new one ends the previous assignment.
        var previous = await db.TrainerClientAssignments
            .Where(a => a.ClientId == client.Id && a.TrainerId != id &&
                        (a.Status == TrainerAssignmentStatus.Active || a.Status == TrainerAssignmentStatus.Paused))
            .ToListAsync();
        foreach (var p in previous) p.Status = TrainerAssignmentStatus.Inactive;

        // A member's home branch follows their trainer assignment if not set yet.
        client.BranchId ??= branchId;

        var assignment = new TrainerClientAssignment
        {
            TenantId = trainer.TenantId,
            TrainerId = id,
            ClientId = client.Id,
            BranchId = branchId,
            Notes = request.Notes,
            Status = TrainerAssignmentStatus.Active
        };
        var created = await repository.AddClientAssignmentAsync(assignment);
        return new TrainerClientResponse
        {
            AssignmentId = created.Id,
            ClientId = created.ClientId,
            Status = created.Status.ToString(),
            AssignedAt = created.AssignedAt
        };
    }

    public Task<bool> UnassignClientAsync(ulong trainerId, ulong clientId) =>
        repository.RemoveClientAssignmentAsync(trainerId, clientId);

    public async Task<List<TrainerScheduleResponse>> GetScheduleAsync(ulong id)
    {
        // Slots have no TenantId — only read them for a trainer of the caller's gym.
        if (await repository.GetByIdAsync(id) is null) return [];
        var slots = await repository.GetSlotsAsync(id);
        return slots.Select(s => new TrainerScheduleResponse
        {
            DayOfWeek = s.DayOfWeek,
            StartTime = s.StartTime,
            EndTime = s.EndTime,
            IsActive = s.IsActive
        }).ToList();
    }

    public async Task<bool> SetScheduleAsync(ulong id, SetScheduleRequest request)
    {
        if (await GetForWriteAsync(id) is null) return false;
        var slots = request.Slots.Select(s => new TrainerAvailabilitySlot
        {
            DayOfWeek = s.DayOfWeek,
            StartTime = s.StartTime,
            EndTime = s.EndTime,
            IsActive = s.IsActive
        }).ToList();
        await repository.SetSlotsAsync(id, slots);
        return true;
    }

    public async Task<TrainerPerformanceResponse> GetPerformanceAsync(ulong id)
    {
        var trainer = await GetForWriteAsync(id) ?? throw new KeyNotFoundException($"Trainer {id} not found.");
        var clients = await repository.GetClientAssignmentsAsync(id);
        return new TrainerPerformanceResponse
        {
            TrainerId = id,
            TotalClients = clients.Count,
            TotalSessions = trainer.TotalSessions,
            Rating = trainer.Rating
        };
    }

    public async Task<TrainerEarningsResponse> GetEarningsAsync(ulong id, int month, int year)
    {
        _ = await GetForWriteAsync(id) ?? throw new KeyNotFoundException($"Trainer {id} not found.");
        // Completed personal-training sessions in that month, and the trainer's PT commission on them.
        var (total, commission, _) = await pt.EarningsAsync(id, month, year);
        return new TrainerEarningsResponse { TrainerId = id, TotalEarnings = total, CommissionEarned = commission, Month = month, Year = year };
    }

    public async Task<TrainerResponse?> AutoAssignAsync(ulong clientId, ulong branchId)
    {
        var trainers = await repository.GetAvailableTrainersAsync(branchId);
        var trainer = trainers.MinBy(t => t.TotalSessions);
        return trainer is null ? null : MapToResponse(trainer);
    }

    private static TrainerResponse MapToResponse(TrainerProfile t) => new()
    {
        Id = t.Id, TenantId = t.TenantId, UserId = t.UserId, BranchId = t.BranchId, BranchName = t.Branch?.Name, TrainerCode = t.TrainerCode,
        DisplayName = t.DisplayName, ProfileImage = t.ProfileImage, Bio = t.Bio,
        ExperienceYears = t.ExperienceYears, Gender = t.Gender, DateOfBirth = t.DateOfBirth,
        Phone = t.Phone, Email = t.Email, Address = t.Address, Notes = t.Notes,
        Rating = t.Rating, IsAvailable = t.IsAvailable, CreatedAt = t.CreatedAt,
        LanguagesKnown = FromJson<List<string>>(t.LanguagesKnown),
        Specializations = FromJson<List<string>>(t.Specializations),
        Certifications = FromJson<object>(t.Certifications),
        Employment = FromJson<object>(t.Employment), Salary = FromJson<object>(t.Salary),
        Allowances = FromJson<object>(t.Allowances), Deductions = FromJson<object>(t.Deductions),
        PaymentDetails = FromJson<object>(t.PaymentDetails), Availability = FromJson<object>(t.Availability),
        BookingSettings = FromJson<object>(t.BookingSettings), CommissionSettings = FromJson<object>(t.CommissionSettings),
        AttendanceSettings = FromJson<object>(t.AttendanceSettings), Documents = FromJson<object>(t.Documents),
        EmergencyContact = FromJson<object>(t.EmergencyContact), SocialLinks = FromJson<object>(t.SocialLinks),
    };

    private static JsonDocument? ToJson<T>(T? value) =>
        value is null ? null : JsonDocument.Parse(JsonSerializer.Serialize(value, _opts));

    private static T? FromJson<T>(JsonDocument? doc) =>
        doc is null ? default : JsonSerializer.Deserialize<T>(doc.RootElement.GetRawText(), _opts);
}
