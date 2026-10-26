using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutBuilder.Interfaces;
using GymManagmentApplication.Application.WorkoutBuilder.Requests;
using GymManagmentApplication.Application.WorkoutBuilder.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.WorkoutBuilder.Services;

public class WorkoutBuilderService(AppDbContext db, ICurrentUser currentUser) : IWorkoutBuilderService
{
    /// <summary>
    /// WorkoutSection has no TenantId, so check the parent workout through the tenant-filtered
    /// WorkoutTemplates set (another gym's workout is "not found"). Trainers may only build
    /// workouts they created; admins and staff any workout in their gym.
    /// </summary>
    private async Task EnsureWorkoutAsync(ulong workoutId)
    {
        var workout = await db.WorkoutTemplates.FirstOrDefaultAsync(w => w.Id == workoutId)
            ?? throw new KeyNotFoundException($"Workout {workoutId} not found.");
        if (currentUser.IsTrainer() && workout.CreatedBy != currentUser.UserId)
            throw new UnauthorizedAccessException("You can only edit workouts you created.");
    }

    public async Task<SectionResponse> AddCircuitAsync(ulong workoutId, AddCircuitRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        var section = await CreateSectionAsync(workoutId, request.Name ?? "Circuit",
            SectionType.Circuit, request.Rounds, request.RestSeconds);
        return MapSection(section);
    }

    public async Task<SectionResponse?> UpdateCircuitAsync(ulong workoutId, ulong circuitId, UpdateCircuitRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        var section = await db.WorkoutSections
            .FirstOrDefaultAsync(s => s.Id == circuitId && s.TemplateId == workoutId);
        if (section is null) return null;

        if (request.Name is not null) section.Name = request.Name;
        if (request.Rounds.HasValue) section.Rounds = request.Rounds.Value;
        if (request.RestSeconds.HasValue) section.RestSeconds = request.RestSeconds;
        await db.SaveChangesAsync();
        return MapSection(section);
    }

    public async Task<SectionResponse> AddSupersetAsync(ulong workoutId, AddSupersetRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        var section = await CreateSectionAsync(workoutId, "Superset",
            SectionType.Superset, request.Sets, request.RestSeconds);
        return MapSection(section);
    }

    public async Task<SectionResponse> AddDropsetAsync(ulong workoutId, AddDropsetRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        var section = await CreateSectionAsync(workoutId, "Dropset", SectionType.Dropset, 1, null);
        return MapSection(section);
    }

    public async Task<SectionResponse> AddPyramidAsync(ulong workoutId, AddPyramidRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        var section = await CreateSectionAsync(workoutId,
            $"Pyramid ({request.Direction})", SectionType.Pyramid, 1, null);
        return MapSection(section);
    }

    public async Task<BuilderConfigResponse> SetTempoAsync(ulong workoutId, SetTempoRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        return BuildConfig(workoutId, "tempo", request);
    }

    public async Task<BuilderConfigResponse> SetRestIntervalsAsync(ulong workoutId, SetRestIntervalsRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        return BuildConfig(workoutId, "rest-intervals", request);
    }

    public async Task<BuilderConfigResponse> ConfigureTimerAsync(ulong workoutId, ConfigureTimerRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        return BuildConfig(workoutId, "timer", request);
    }

    public async Task<BuilderConfigResponse> SetDifficultyAsync(ulong workoutId, SetDifficultyRequest request)
    {
        await EnsureWorkoutAsync(workoutId);
        return BuildConfig(workoutId, "difficulty", request);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<WorkoutSection> CreateSectionAsync(ulong workoutId, string name,
        SectionType type, byte rounds, ushort? restSeconds)
    {
        var sortOrder = (byte)await db.WorkoutSections.CountAsync(s => s.TemplateId == workoutId);
        var maxId = await db.WorkoutSections.IgnoreQueryFilters().MaxAsync(s => (ulong?)s.Id) ?? 0;

        var section = new WorkoutSection
        {
            Id = maxId + 1,
            TemplateId = workoutId,
            Name = name,
            Type = type,
            Rounds = rounds,
            RestSeconds = restSeconds,
            SortOrder = sortOrder
        };
        db.WorkoutSections.Add(section);
        await db.SaveChangesAsync();
        return section;
    }

    private static SectionResponse MapSection(WorkoutSection s) => new()
    {
        Id = s.Id, WorkoutId = s.TemplateId, Name = s.Name,
        Type = s.Type.ToString(), SortOrder = s.SortOrder,
        Rounds = s.Rounds, RestSeconds = s.RestSeconds
    };

    private static BuilderConfigResponse BuildConfig(ulong workoutId, string type, object config) => new()
    {
        WorkoutId = workoutId, ConfigType = type,
        Config = config, UpdatedAt = DateTime.UtcNow
    };
}
