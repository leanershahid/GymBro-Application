using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Exercise.Interfaces;
using GymManagmentApplication.Application.Exercise.Requests;
using GymManagmentApplication.Application.Exercise.Responses;
using GymManagmentApplication.Infrastructure.Repositories.Exercise;
using Microsoft.AspNetCore.Http;

namespace GymManagmentApplication.Application.Exercise.Services;

public class ExerciseService(IExerciseRepository repository) : IExerciseService
{
    public async Task<PagedResponse<ExerciseResponse>> GetAllAsync(ExerciseListRequest request)
    {
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<ExerciseResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<ExerciseResponse> CreateAsync(ulong userId, CreateExerciseRequest request)
    {
        var slug = request.Name.ToLower().Replace(" ", "-");
        var tags = request.Tags is not null
            ? JsonDocument.Parse(JsonSerializer.Serialize(request.Tags))
            : null;

        var entity = new Domain.Entities.Training.Exercise
        {
            TenantId = request.TenantId,
            CreatedBy = userId,
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            Instructions = request.Instructions,
            Category = request.Category,
            Difficulty = request.Difficulty,
            IsCustom = true,
            Tags = tags
        };

        if (request.MuscleIds is not null)
            entity.ExerciseMuscles = request.MuscleIds
                .Select(mid => new Domain.Entities.Training.ExerciseMuscle { MuscleId = mid }).ToList();

        if (request.EquipmentIds is not null)
            entity.ExerciseEquipments = request.EquipmentIds
                .Select(eid => new Domain.Entities.Training.ExerciseEquipment { EquipmentId = eid }).ToList();

        var created = await repository.CreateAsync(entity);
        return Map(created);
    }

    public async Task<ExerciseResponse?> GetByIdAsync(ulong id)
    {
        var e = await repository.GetByIdAsync(id);
        return e is null ? null : Map(e);
    }

    public async Task<ExerciseResponse?> UpdateAsync(ulong id, UpdateExerciseRequest request)
    {
        var e = await repository.GetByIdAsync(id);
        if (e is null) return null;
        if (request.Name is not null) { e.Name = request.Name; e.Slug = request.Name.ToLower().Replace(" ", "-"); }
        if (request.Description is not null) e.Description = request.Description;
        if (request.Instructions is not null) e.Instructions = request.Instructions;
        if (request.Category.HasValue) e.Category = request.Category.Value;
        if (request.Difficulty.HasValue) e.Difficulty = request.Difficulty.Value;
        if (request.Tags is not null)
            e.Tags = JsonDocument.Parse(JsonSerializer.Serialize(request.Tags));
        await repository.UpdateAsync(e);
        return Map(e);
    }

    public Task<bool> DeleteAsync(ulong id) => repository.DeleteAsync(id);

    public async Task<List<ExerciseResponse>> GetAlternativesAsync(ulong id)
    {
        var alts = await repository.GetAlternativesAsync(id);
        return alts.Select(Map).ToList();
    }

    public async Task<string> UploadVideoAsync(ulong id, IFormFile video)
    {
        var e = await repository.GetByIdAsync(id);
        if (e is null) return string.Empty;
        var url = $"/uploads/exercises/{id}/{video.FileName}";
        e.VideoUrl = url;
        await repository.UpdateAsync(e);
        return url;
    }

    public async Task<VideoAnnotationResponse> AnnotateVideoAsync(ulong id, AnnotateVideoRequest request)
    {
        var e = await repository.GetByIdAsync(id);
        return new VideoAnnotationResponse
        {
            VideoUrl = e?.VideoUrl ?? string.Empty,
            Annotations = request.Annotations.Cast<object>().ToList()
        };
    }

    public async Task<List<ExerciseTagResponse>> GetTagsAsync()
    {
        var tags = await repository.GetAllTagsAsync();
        return tags.Select(t => new ExerciseTagResponse { Tag = t, Count = 1 }).ToList();
    }

    public async Task<List<MuscleGroupResponse>> GetMusclesAsync()
    {
        var muscles = await repository.GetAllMusclesAsync();
        return muscles.Select(m => new MuscleGroupResponse { Id = m.Id, Name = m.Name }).ToList();
    }

    public Task<PagedResponse<ExerciseResponse>> GetByEquipmentAsync(ExerciseListRequest request) =>
        GetAllAsync(request);

    private static ExerciseResponse Map(Domain.Entities.Training.Exercise e) => new()
    {
        Id = e.Id,
        Name = e.Name,
        Slug = e.Slug,
        Description = e.Description,
        Instructions = e.Instructions,
        Category = e.Category.ToString(),
        Difficulty = e.Difficulty.ToString(),
        VideoUrl = e.VideoUrl,
        ThumbnailUrl = e.ThumbnailUrl,
        IsCustom = e.IsCustom,
        Tags = e.Tags is not null
            ? e.Tags.RootElement.EnumerateArray().Select(t => t.GetString() ?? "").ToList()
            : [],
        Muscles = e.ExerciseMuscles.Select(m => new MuscleResponse
        {
            Id = m.MuscleId,
            Name = m.Muscle?.Name ?? string.Empty,
            Role = m.Role.ToString()
        }).ToList(),
        Equipment = e.ExerciseEquipments.Select(eq => new EquipmentResponse
        {
            Id = eq.EquipmentId,
            Name = eq.Equipment?.Name ?? string.Empty,
            Category = eq.Equipment?.Category
        }).ToList(),
        CreatedAt = e.CreatedAt
    };
}
