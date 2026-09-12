using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutPlan.Requests;
using GymManagmentApplication.Application.WorkoutPlan.Responses;

namespace GymManagmentApplication.Application.WorkoutPlan.Interfaces;

public interface IWorkoutPlanService
{
    Task<PagedResponse<PlanResponse>> GetAllAsync(PlanListRequest request);
    Task<PlanResponse> CreateAsync(ulong userId, CreatePlanRequest request);
    Task<PlanResponse?> GetByIdAsync(ulong id);
    Task<PlanResponse?> UpdateAsync(ulong id, UpdatePlanRequest request);
    Task<bool> DeleteAsync(ulong id);
    Task<PlanTreeResponse?> GetTreeAsync(ulong id);
    Task<bool> AddBranchAsync(ulong id, AddBranchRequest request);
    Task<bool> UpdateProgressionAsync(ulong id, UpdateProgressionRequest request);
    Task<List<PlanMemberResponse>> AssignAsync(ulong id, AssignPlanRequest request);
    Task<List<PlanMemberResponse>> GetMembersAsync(ulong id);
    Task<PlanAnalyticsResponse?> GetAnalyticsAsync(ulong id);
}
