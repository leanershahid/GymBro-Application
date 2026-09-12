using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Interfaces;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Application.Workout.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.Workout;

namespace GymManagmentApplication.Application.Workout.Services;

public class WorkoutService(IWorkoutRepository repository) : IWorkoutService
{
    private static readonly HashSet<(ulong WorkoutId, ulong UserId)> _bookmarks = [];

    public async Task<PagedResponse<WorkoutResponse>> GetAllAsync(WorkoutListRequest request)
    {
        var (items, total) = await repository.GetAllAsync(request);
        return new PagedResponse<WorkoutResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<WorkoutResponse> CreateAsync(ulong userId, CreateWorkoutRequest request)
    {
        var tags = request.Tags is not null
            ? JsonDocument.Parse(JsonSerializer.Serialize(request.Tags))
            : null;

        var template = new WorkoutTemplate
        {
            TenantId = request.TenantId,
            CreatedBy = userId,
            Name = request.Name,
            Description = request.Description,
            Category = request.Category,
            Goal = request.Goal,
            Difficulty = request.Difficulty,
            DurationMin = request.DurationMin,
            IsPublic = request.IsPublic,
            Tags = tags
        };
        var created = await repository.CreateAsync(template);
        return Map(created);
    }

    public async Task<WorkoutResponse?> GetByIdAsync(ulong id)
    {
        var w = await repository.GetByIdAsync(id);
        return w is null ? null : Map(w);
    }

    public async Task<WorkoutResponse?> UpdateAsync(ulong id, UpdateWorkoutRequest request)
    {
        var w = await repository.GetByIdAsync(id);
        if (w is null) return null;
        if (request.Name is not null) w.Name = request.Name;
        if (request.Description is not null) w.Description = request.Description;
        if (request.Category is not null) w.Category = request.Category;
        if (request.Goal.HasValue) w.Goal = request.Goal.Value;
        if (request.Difficulty.HasValue) w.Difficulty = request.Difficulty.Value;
        if (request.DurationMin.HasValue) w.DurationMin = request.DurationMin;
        if (request.IsPublic.HasValue) w.IsPublic = request.IsPublic.Value;
        await repository.UpdateAsync(w);
        return Map(w);
    }

    public Task<bool> DeleteAsync(ulong id) => repository.DeleteAsync(id);

    public async Task<WorkoutResponse?> CloneAsync(ulong id, ulong userId)
    {
        var w = await repository.GetByIdAsync(id);
        if (w is null) return null;
        var clone = new WorkoutTemplate
        {
            TenantId = w.TenantId,
            CreatedBy = userId,
            Name = $"{w.Name} (Copy)",
            Description = w.Description,
            Category = w.Category,
            Goal = w.Goal,
            Difficulty = w.Difficulty,
            DurationMin = w.DurationMin,
            IsPublic = false,
            Tags = w.Tags,
            Version = 1
        };
        var created = await repository.CreateAsync(clone);
        return Map(created);
    }

    public async Task<List<WorkoutLogResponse>> AssignAsync(AssignWorkoutRequest request)
    {
        var results = new List<WorkoutLogResponse>();
        foreach (var memberId in request.MemberIds)
        {
            var assignment = new WorkoutAssignment
            {
                TenantId = 0,
                TrainerId = request.TrainerId,
                ClientId = memberId,
                TemplateId = request.WorkoutId,
                AssignedAt = request.AssignedAt,
                DueDate = request.DueDate,
                Notes = request.Notes
            };
            var created = await repository.CreateAssignmentAsync(assignment);
            results.Add(new WorkoutLogResponse { Id = created.Id, ClientId = memberId, StartedAt = DateTime.UtcNow });
        }
        return results;
    }

    public async Task<WorkoutProgressResponse?> GetProgressAsync(ulong id, ulong clientId)
    {
        var logs = await repository.GetLogsByWorkoutAndClientAsync(id, clientId);
        var total = logs.Count;
        var completed = logs.Count(l => l.EndedAt.HasValue);
        return new WorkoutProgressResponse
        {
            WorkoutId = id,
            ClientId = clientId,
            TotalSessions = total,
            CompletedSessions = completed,
            CompletionRate = total > 0 ? (double)completed / total * 100 : 0,
            LastCompletedAt = logs.Where(l => l.EndedAt.HasValue).OrderByDescending(l => l.EndedAt).FirstOrDefault()?.EndedAt
        };
    }

    public async Task<WorkoutLogResponse> CompleteAsync(ulong id, CompleteWorkoutRequest request)
    {
        var duration = (short)(request.EndedAt - request.StartedAt).TotalMinutes;
        var log = new WorkoutLog
        {
            ClientId = request.ClientId,
            TemplateId = id,
            StartedAt = request.StartedAt,
            EndedAt = request.EndedAt,
            DurationMin = duration,
            Calories = request.Calories,
            Notes = request.Notes,
            MoodBefore = request.MoodBefore,
            MoodAfter = request.MoodAfter,
            FatigueLevel = request.FatigueLevel
        };
        var created = await repository.CreateLogAsync(log);
        return new WorkoutLogResponse
        {
            Id = created.Id,
            ClientId = created.ClientId,
            StartedAt = created.StartedAt,
            EndedAt = created.EndedAt,
            DurationMin = created.DurationMin,
            Score = created.Score,
            Calories = created.Calories,
            Notes = created.Notes
        };
    }

    public async Task<WorkoutScoreResponse?> GetScoreAsync(ulong id, ulong clientId)
    {
        var logs = await repository.GetLogsByWorkoutAndClientAsync(id, clientId);
        var lastLog = logs.OrderByDescending(l => l.CreatedAt).FirstOrDefault();
        if (lastLog is null) return null;
        var score = lastLog.Score ?? 75m;
        return new WorkoutScoreResponse
        {
            WorkoutId = id,
            ClientId = clientId,
            Score = score,
            Grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D",
            ScoredAt = lastLog.CreatedAt
        };
    }

    public Task<bool> ShareAsync(ulong id, ulong userId) => Task.FromResult(true);

    public Task<bool> BookmarkAsync(ulong id, ulong userId)
    {
        var key = (id, userId);
        if (_bookmarks.Contains(key)) _bookmarks.Remove(key);
        else _bookmarks.Add(key);
        return Task.FromResult(true);
    }

    private static WorkoutResponse Map(WorkoutTemplate w) => new()
    {
        Id = w.Id,
        TenantId = w.TenantId,
        Name = w.Name,
        Description = w.Description,
        Category = w.Category,
        Goal = w.Goal.ToString(),
        Difficulty = w.Difficulty.ToString(),
        DurationMin = w.DurationMin,
        IsPublic = w.IsPublic,
        IsAiGenerated = w.IsAiGenerated,
        Version = w.Version,
        Tags = w.Tags is not null
            ? w.Tags.RootElement.EnumerateArray().Select(t => t.GetString() ?? "").ToList()
            : [],
        CreatedAt = w.CreatedAt
    };
}
