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
    Task<PlanAnalyticsResponse?> GetAnalyticsAsync(ulong id);
}
