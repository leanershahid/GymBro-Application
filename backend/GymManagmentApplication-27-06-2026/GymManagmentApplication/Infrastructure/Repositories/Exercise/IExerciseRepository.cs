using GymManagmentApplication.Application.Exercise.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using ExerciseEntity = GymManagmentApplication.Domain.Entities.Training.Exercise;

namespace GymManagmentApplication.Infrastructure.Repositories.Exercise;

public interface IExerciseRepository
{
    Task<(List<ExerciseEntity> Items, int Total)> GetAllAsync(ExerciseListRequest request);
    Task<ExerciseEntity> CreateAsync(ExerciseEntity exercise);
    Task<ExerciseEntity?> GetByIdAsync(ulong id);
    Task<ExerciseEntity?> UpdateAsync(ExerciseEntity exercise);
    Task<bool> DeleteAsync(ulong id);
    Task<List<ExerciseEntity>> GetAlternativesAsync(ulong id);
    Task<List<string>> GetAllTagsAsync();
    Task<List<MuscleGroup>> GetAllMusclesAsync();
    Task<List<Equipment>> GetAllEquipmentAsync();
}
