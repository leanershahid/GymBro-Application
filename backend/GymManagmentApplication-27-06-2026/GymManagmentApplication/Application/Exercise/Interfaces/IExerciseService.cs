using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Exercise.Requests;
using GymManagmentApplication.Application.Exercise.Responses;
using Microsoft.AspNetCore.Http;

namespace GymManagmentApplication.Application.Exercise.Interfaces;

public interface IExerciseService
{
    Task<PagedResponse<ExerciseResponse>> GetAllAsync(ExerciseListRequest request);
    Task<ExerciseResponse> CreateAsync(ulong userId, CreateExerciseRequest request);
    Task<ExerciseResponse?> GetByIdAsync(ulong id);
    Task<ExerciseResponse?> UpdateAsync(ulong id, UpdateExerciseRequest request);
    Task<bool> DeleteAsync(ulong id);
    Task<List<ExerciseResponse>> GetAlternativesAsync(ulong id);
    Task<string> UploadVideoAsync(ulong id, IFormFile video);
    Task<VideoAnnotationResponse> AnnotateVideoAsync(ulong id, AnnotateVideoRequest request);
    Task<List<ExerciseTagResponse>> GetTagsAsync();
    Task<List<MuscleGroupResponse>> GetMusclesAsync();
    Task<PagedResponse<ExerciseResponse>> GetByEquipmentAsync(ExerciseListRequest request);
}
