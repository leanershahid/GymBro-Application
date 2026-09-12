using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutPlan.Interfaces;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Application.WorkoutPlan.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.WorkoutPlan;

namespace GymManagmentApplication.Application.WorkoutPlan.Services;

public class WorkoutPlanService(IWorkoutPlanRepository repository) : IWorkoutPlanService
{
    public async Task<PagedResponse<PlanResponse>> GetAllAsync(PlanListRequest request)
    {
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
        var plan = new Domain.Entities.Training.WorkoutPlan
        {
            TenantId = request.TenantId,
            CreatedBy = userId,
            Name = request.Name,
            Description = request.Description,
            DurationWeeks = request.DurationWeeks,
            Goal = request.Goal,
            Difficulty = request.Difficulty
        };
        return Map(await repository.CreateAsync(plan));
    }

    public async Task<PlanResponse?> GetByIdAsync(ulong id)
    {
        var p = await repository.GetByIdAsync(id);
        return p is null ? null : Map(p);
    }

    public async Task<PlanResponse?> UpdateAsync(ulong id, UpdatePlanRequest request)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return null;
        if (request.Name is not null) p.Name = request.Name;
        if (request.Description is not null) p.Description = request.Description;
        if (request.DurationWeeks.HasValue) p.DurationWeeks = request.DurationWeeks.Value;
        if (request.Goal.HasValue) p.Goal = request.Goal.Value;
        if (request.Difficulty.HasValue) p.Difficulty = request.Difficulty.Value;
        if (request.IsActive.HasValue) p.IsActive = request.IsActive.Value;
        await repository.UpdateAsync(p);
        return Map(p);
    }

    public Task<bool> DeleteAsync(ulong id) => repository.DeleteAsync(id);

    public async Task<PlanTreeResponse?> GetTreeAsync(ulong id)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return null;
        var nodes = p.Weeks.Select(w => new PlanTreeNode
        {
            Id = w.Id,
            Name = $"Week {w.WeekNumber}",
            Type = "week",
            Children = w.Days.Select(d => new PlanTreeNode
            {
                Id = d.Id,
                Name = d.IsRestDay ? "Rest Day" : $"Day {d.DayNumber}",
                Type = d.IsRestDay ? "rest" : "workout"
            }).ToList()
        }).ToList();
        return new PlanTreeResponse { PlanId = id, Nodes = nodes };
    }

    public async Task<bool> AddBranchAsync(ulong id, AddBranchRequest request)
    {
        var branch = new WorkoutPlanBranch
        {
            PlanId = id,
            Name = request.Name,
            Condition = request.Condition,
            NextPlanId = request.NextPlanId,
            SortOrder = request.SortOrder
        };
        await repository.CreateBranchAsync(branch);
        return true;
    }

    public async Task<bool> UpdateProgressionAsync(ulong id, UpdateProgressionRequest request)
    {
        var p = await repository.GetByIdAsync(id);
        if (p is null) return false;
        p.ProgressionRules = request.Rules;
        await repository.UpdateAsync(p);
        return true;
    }

    public async Task<List<PlanMemberResponse>> AssignAsync(ulong id, AssignPlanRequest request)
    {
        var results = new List<PlanMemberResponse>();
        foreach (var memberId in request.MemberIds)
        {
            var assignment = new WorkoutPlanAssignment
            {
                PlanId = id,
                ClientId = memberId,
                TrainerId = request.TrainerId,
                StartDate = request.StartDate
            };
            var created = await repository.CreateAssignmentAsync(assignment);
            results.Add(new PlanMemberResponse
            {
                AssignmentId = created.Id,
                ClientId = memberId,
                StartDate = created.StartDate,
                Status = created.Status.ToString()
            });
        }
        return results;
    }

    public async Task<List<PlanMemberResponse>> GetMembersAsync(ulong id)
    {
        var assignments = await repository.GetAssignmentsAsync(id);
        return assignments.Select(a => new PlanMemberResponse
        {
            AssignmentId = a.Id,
            ClientId = a.ClientId,
            StartDate = a.StartDate,
            Status = a.Status.ToString()
        }).ToList();
    }

    public async Task<PlanAnalyticsResponse?> GetAnalyticsAsync(ulong id)
    {
        var assignments = await repository.GetAssignmentsAsync(id);
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
        CreatedAt = p.CreatedAt
    };
}
