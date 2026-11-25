using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutPlan.Interfaces;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Application.WorkoutPlan.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.WorkoutPlan.Services;

public class WorkoutPlanService(IWorkoutPlanRepository repository, ICurrentUser currentUser, IAppDbContext db) : IWorkoutPlanService
{
    public async Task<PagedResponse<PlanResponse>> GetAllAsync(PlanListRequest request)
    {
        // Members see only the plans assigned to them ("My plans"), never the gym's whole catalogue.
        request.AssignedToUserId = currentUser.IsClient() ? currentUser.UserId ?? 0 : null;
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<PlanResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<PlanResponse> CreateAsync(ulong userId, CreatePlanRequest request)
    {
        request.TenantId = currentUser.ResolveTenantId(request.TenantId);
        var plan = new Domain.Entities.Training.WorkoutPlan
        {
            TenantId = request.TenantId,
            CreatedBy = userId,
            Name = request.Name,
            Description = request.Description,
            DurationWeeks = request.DurationWeeks,
            Goal = request.Goal,
            Difficulty = request.Difficulty,
            DaysPerWeekHint = request.DaysPerWeekHint,
            IsTemplate = true,
        };
        return Map(await repository.CreateAsync(plan));
    }

    public async Task<PlanResponse?> GetByIdAsync(ulong id)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return null;
        if (currentUser.IsClient() && !await Training.PlanAccess.MemberIsAssignedAsync(db, currentUser.UserId ?? 0, p.Id)) return null;
        return Map(p);
    }

    /// <summary>Trainers: plans they created or their own clients' copies; admins/staff any in their gym.</summary>
    private Task EnsureCanEdit(Domain.Entities.Training.WorkoutPlan p) => Training.PlanAccess.EnsureCanEditAsync(db, currentUser, p);

    public async Task<PlanResponse?> UpdateAsync(ulong id, UpdatePlanRequest request)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return null;
        await EnsureCanEdit(p);
        if (request.Name is not null) p.Name = request.Name;
        if (request.Description is not null) p.Description = request.Description;
        if (request.DurationWeeks.HasValue) p.DurationWeeks = request.DurationWeeks.Value;
        if (request.Goal.HasValue) p.Goal = request.Goal.Value;
        if (request.Difficulty.HasValue) p.Difficulty = request.Difficulty.Value;
        if (request.IsActive.HasValue) p.IsActive = request.IsActive.Value;
        if (request.DaysPerWeekHint.HasValue) p.DaysPerWeekHint = request.DaysPerWeekHint is 0 ? null : request.DaysPerWeekHint;
        await repository.UpdateAsync(p);
        return Map(p);
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return false;
        await EnsureCanEdit(p);
        return await repository.DeleteAsync(id);
    }

    public async Task<PlanAnalyticsResponse?> GetAnalyticsAsync(ulong id)
    {
        var assignments = await db.WorkoutPlanAssignments
            .Where(a => a.PlanId == id || db.WorkoutPlans.Any(c => c.Id == a.PlanId && c.SourcePlanId == id && !c.IsTemplate)).ToListAsync();
        var total = assignments.Count;
        var completed = assignments.Count(a => a.Status == AssignmentStatus.Completed);
        var inProgress = assignments.Count(a => a.Status == AssignmentStatus.InProgress);
        return new PlanAnalyticsResponse
        {
            PlanId = id,
            TotalAssigned = total,
            Completed = completed,
            InProgress = inProgress,
            CompletionRate = total > 0 ? (double)completed / total * 100 : 0
        };
    }

    private static PlanResponse Map(Domain.Entities.Training.WorkoutPlan p) => new()
    {
        Id = p.Id,
        TenantId = p.TenantId,
        Name = p.Name,
        Description = p.Description,
        DurationWeeks = p.DurationWeeks,
        Goal = p.Goal.ToString(),
        Difficulty = p.Difficulty.ToString(),
        IsActive = p.IsActive,
        IsTemplate = p.IsTemplate,
        SourcePlanId = p.SourcePlanId,
        OwnerClientId = p.OwnerClientId,
        DaysPerWeekHint = p.DaysPerWeekHint,
        CreatedBy = p.CreatedBy,
        CreatedAt = p.CreatedAt
    };
}
