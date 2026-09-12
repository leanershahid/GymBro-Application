using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Application.Workout.Responses;

namespace GymManagmentApplication.Application.Workout.Interfaces;

public interface IWorkoutService
{
    Task<PagedResponse<WorkoutResponse>> GetAllAsync(WorkoutListRequest request);
    Task<WorkoutResponse> CreateAsync(ulong userId, CreateWorkoutRequest request);
    Task<WorkoutResponse?> GetByIdAsync(ulong id);
    Task<WorkoutResponse?> UpdateAsync(ulong id, UpdateWorkoutRequest request);
    Task<bool> DeleteAsync(ulong id);
    Task<WorkoutResponse?> CloneAsync(ulong id, ulong userId);
    Task<List<WorkoutLogResponse>> AssignAsync(AssignWorkoutRequest request);
    Task<WorkoutProgressResponse?> GetProgressAsync(ulong id, ulong clientId);
    Task<WorkoutLogResponse> CompleteAsync(ulong id, CompleteWorkoutRequest request);
    Task<WorkoutScoreResponse?> GetScoreAsync(ulong id, ulong clientId);
    Task<bool> ShareAsync(ulong id, ulong userId);
    Task<bool> BookmarkAsync(ulong id, ulong userId);
}
