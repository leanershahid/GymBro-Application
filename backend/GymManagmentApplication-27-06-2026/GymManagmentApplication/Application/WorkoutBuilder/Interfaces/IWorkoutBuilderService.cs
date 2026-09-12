using GymManagmentApplication.Application.WorkoutBuilder.Requests;
using GymManagmentApplication.Application.WorkoutBuilder.Responses;

namespace GymManagmentApplication.Application.WorkoutBuilder.Interfaces;

public interface IWorkoutBuilderService
{
    Task<SectionResponse> AddCircuitAsync(ulong workoutId, AddCircuitRequest request);
    Task<SectionResponse?> UpdateCircuitAsync(ulong workoutId, ulong circuitId, UpdateCircuitRequest request);
    Task<SectionResponse> AddSupersetAsync(ulong workoutId, AddSupersetRequest request);
    Task<SectionResponse> AddDropsetAsync(ulong workoutId, AddDropsetRequest request);
    Task<SectionResponse> AddPyramidAsync(ulong workoutId, AddPyramidRequest request);
    Task<BuilderConfigResponse> SetTempoAsync(ulong workoutId, SetTempoRequest request);
    Task<BuilderConfigResponse> SetRestIntervalsAsync(ulong workoutId, SetRestIntervalsRequest request);
    Task<BuilderConfigResponse> ConfigureTimerAsync(ulong workoutId, ConfigureTimerRequest request);
    Task<BuilderConfigResponse> SetDifficultyAsync(ulong workoutId, SetDifficultyRequest request);
}
