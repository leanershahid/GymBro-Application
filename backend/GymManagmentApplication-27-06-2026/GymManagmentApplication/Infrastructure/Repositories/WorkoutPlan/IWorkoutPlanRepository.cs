using GymManagmentApplication.Application.WorkoutPlan.Requests;
using Plan = GymManagmentApplication.Domain.Entities.Training.WorkoutPlan;
using GymManagmentApplication.Domain.Entities.Training;

namespace GymManagmentApplication.Infrastructure.Repositories.WorkoutPlan;

public interface IWorkoutPlanRepository
{
    Task<(List<Plan> Items, int Total)> GetAllAsync(PlanListRequest request);
    Task<Plan> CreateAsync(Plan plan);
    Task<Plan?> GetByIdAsync(ulong id);
    Task<Plan?> UpdateAsync(Plan plan);
    Task<bool> DeleteAsync(ulong id);
    Task<WorkoutPlanBranch> CreateBranchAsync(WorkoutPlanBranch branch);
    Task<WorkoutPlanAssignment> CreateAssignmentAsync(WorkoutPlanAssignment assignment);
    Task<List<WorkoutPlanAssignment>> GetAssignmentsAsync(ulong planId);
}
