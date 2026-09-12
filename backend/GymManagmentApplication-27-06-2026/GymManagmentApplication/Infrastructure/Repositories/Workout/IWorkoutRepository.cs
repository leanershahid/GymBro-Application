using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Domain.Entities.Training;

namespace GymManagmentApplication.Infrastructure.Repositories.Workout;

public interface IWorkoutRepository
{
    Task<(List<WorkoutTemplate> Items, int Total)> GetAllAsync(WorkoutListRequest request);
    Task<WorkoutTemplate> CreateAsync(WorkoutTemplate template);
    Task<WorkoutTemplate?> GetByIdAsync(ulong id);
    Task<WorkoutTemplate?> UpdateAsync(WorkoutTemplate template);
    Task<bool> DeleteAsync(ulong id);
    Task<WorkoutAssignment> CreateAssignmentAsync(WorkoutAssignment assignment);
    Task<WorkoutLog> CreateLogAsync(WorkoutLog log);
    Task<List<WorkoutLog>> GetLogsByWorkoutAndClientAsync(ulong workoutId, ulong clientId);
}
