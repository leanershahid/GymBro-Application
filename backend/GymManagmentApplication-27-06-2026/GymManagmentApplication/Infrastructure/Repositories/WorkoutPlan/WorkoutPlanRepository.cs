using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;

namespace GymManagmentApplication.Infrastructure.Repositories.WorkoutPlan;

public class WorkoutPlanRepository(AppDbContext db) : IWorkoutPlanRepository
{
    public async Task<(List<Plan> Items, int Total)> GetAllAsync(PlanListRequest request)
    {
        var q = db.WorkoutPlans.Where(p => p.IsActive);

        if (request.TenantId.HasValue)
            q = q.Where(p => p.TenantId == request.TenantId.Value);
        if (request.Goal.HasValue)
            q = q.Where(p => p.Goal == request.Goal.Value);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(p => p.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<Plan> CreateAsync(Plan plan)
    {
        var maxId = await db.WorkoutPlans.MaxAsync(p => (ulong?)p.Id) ?? 0;
        plan.Id        = maxId + 1;
        plan.CreatedAt = DateTime.UtcNow;
        plan.UpdatedAt = DateTime.UtcNow;
        db.WorkoutPlans.Add(plan);
        await db.SaveChangesAsync();
        return plan;
    }

    public async Task<Plan?> GetByIdAsync(ulong id) =>
        await db.WorkoutPlans
            .Include(p => p.Branches)
            .FirstOrDefaultAsync(p => p.Id == id);

    public async Task<Plan?> UpdateAsync(Plan plan)
    {
        var existing = await db.WorkoutPlans.FindAsync(plan.Id);
        if (existing is null) return null;
        plan.UpdatedAt = DateTime.UtcNow;
        db.WorkoutPlans.Update(plan);
        await db.SaveChangesAsync();
        return plan;
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var p = await db.WorkoutPlans.FindAsync(id);
        if (p is null) return false;
        p.IsActive  = false;
        p.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<WorkoutPlanBranch> CreateBranchAsync(WorkoutPlanBranch branch)
    {
        var maxId = await db.WorkoutPlanBranches.MaxAsync(b => (ulong?)b.Id) ?? 0;
        branch.Id = maxId + 1;
        db.WorkoutPlanBranches.Add(branch);
        await db.SaveChangesAsync();
        return branch;
    }

    public async Task<WorkoutPlanAssignment> CreateAssignmentAsync(WorkoutPlanAssignment assignment)
    {
        var maxId = await db.WorkoutPlanAssignments.MaxAsync(a => (ulong?)a.Id) ?? 0;
        assignment.Id        = maxId + 1;
        assignment.CreatedAt = DateTime.UtcNow;
        db.WorkoutPlanAssignments.Add(assignment);
        await db.SaveChangesAsync();
        return assignment;
    }

    public async Task<List<WorkoutPlanAssignment>> GetAssignmentsAsync(ulong planId) =>
        await db.WorkoutPlanAssignments
            .Where(a => a.PlanId == planId)
            .ToListAsync();
}
