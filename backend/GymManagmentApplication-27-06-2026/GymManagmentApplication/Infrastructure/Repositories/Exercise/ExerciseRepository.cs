using GymManagmentApplication.Application.Exercise.Requests;
using GymManagmentApplication.Infrastructure.Data;
using ExerciseEntity = GymManagmentApplication.Domain.Entities.Training.Exercise;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.Exercise;

public class ExerciseRepository(AppDbContext db) : IExerciseRepository
{
    public async Task<(List<ExerciseEntity> Items, int Total)> GetAllAsync(ExerciseListRequest request)
    {
        var q = db.Exercises.Where(e => e.IsActive);

        if (request.MuscleId.HasValue)
            q = q.Where(e => e.ExerciseMuscles.Any(m => m.MuscleId == request.MuscleId.Value));

        if (request.EquipmentId.HasValue)
            q = q.Where(e => e.ExerciseEquipments.Any(eq => eq.EquipmentId == request.EquipmentId.Value));

        var total = await q.CountAsync();
        var items = await q
            .Include(e => e.ExerciseMuscles)
            .Include(e => e.ExerciseEquipments)
            .OrderBy(e => e.Name)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<ExerciseEntity> CreateAsync(ExerciseEntity exercise)
    {
        var maxId = await db.Exercises.MaxAsync(e => (ulong?)e.Id) ?? 0;
        exercise.Id        = maxId + 1;
        exercise.CreatedAt = DateTime.UtcNow;
        db.Exercises.Add(exercise);
        await db.SaveChangesAsync();
        return exercise;
    }

    public async Task<ExerciseEntity?> GetByIdAsync(ulong id) =>
        await db.Exercises
            .Include(e => e.ExerciseMuscles)
            .Include(e => e.ExerciseEquipments)
            .FirstOrDefaultAsync(e => e.Id == id);

    public async Task<ExerciseEntity?> UpdateAsync(ExerciseEntity exercise)
    {
        var existing = await db.Exercises.FindAsync(exercise.Id);
        if (existing is null) return null;
        exercise.UpdatedAt = DateTime.UtcNow;
        db.Exercises.Update(exercise);
        await db.SaveChangesAsync();
        return exercise;
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var e = await db.Exercises.FindAsync(id);
        if (e is null) return false;
        e.IsActive = false;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<ExerciseEntity>> GetAlternativesAsync(ulong id)
    {
        var ex = await db.Exercises.FindAsync(id);
        if (ex is null) return [];
        return await db.Exercises
            .Where(e => e.Id != id && e.Category == ex.Category && e.IsActive)
            .Take(5).ToListAsync();
    }

    public async Task<List<string>> GetAllTagsAsync()
    {
        var exercises = await db.Exercises
            .Where(e => e.Tags != null && e.IsActive)
            .Select(e => e.Tags)
            .ToListAsync();

        return exercises
            .Where(t => t is not null)
            .SelectMany(t => t!.RootElement.EnumerateArray().Select(v => v.GetString() ?? ""))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct().OrderBy(s => s).ToList();
    }

    public async Task<List<MuscleGroup>> GetAllMusclesAsync() =>
        await db.MuscleGroups.OrderBy(m => m.Name).ToListAsync();

    public async Task<List<Equipment>> GetAllEquipmentAsync() =>
        await db.Equipment.OrderBy(e => e.Name).ToListAsync();
}
