using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

using GymManagmentApplication.Application.Workout.Interfaces;

namespace GymManagmentApplication.Infrastructure.Repositories.Workout;

public class WorkoutRepository(AppDbContext db) : IWorkoutRepository
{
    public async Task<(List<WorkoutTemplate> Items, int Total)> GetAllAsync(WorkoutListRequest request)
    {
        var q = db.WorkoutTemplates.AsQueryable();

        if (request.Difficulty.HasValue)
            q = q.Where(w => w.Difficulty == request.Difficulty.Value);
        if (!string.IsNullOrEmpty(request.Category))
            q = q.Where(w => w.Category == request.Category);

        var total = await q.CountAsync();
        var items = await q
            .OrderBy(w => w.Name)
            .Page(request.PageNumber, request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<WorkoutTemplate> CreateAsync(WorkoutTemplate template)
    {
        template.CreatedAt = DateTime.UtcNow;
        template.UpdatedAt = DateTime.UtcNow;
        db.WorkoutTemplates.Add(template);
        await db.SaveChangesAsync();
        return template;
    }

    public async Task<WorkoutTemplate?> GetByIdAsync(ulong id) =>
        await db.WorkoutTemplates
            .Include(w => w.Sections)
            .FirstOrDefaultAsync(w => w.Id == id);

    public async Task<WorkoutTemplate?> UpdateAsync(WorkoutTemplate template)
    {
        var existing = await db.WorkoutTemplates.FindAsync(template.Id);
        if (existing is null) return null;
        template.UpdatedAt = DateTime.UtcNow;
        db.WorkoutTemplates.Update(template);
        await db.SaveChangesAsync();
        return template;
    }

    public async Task<bool> DeleteAsync(ulong id)
    {
        var w = await db.WorkoutTemplates.FindAsync(id);
        if (w is null) return false;
        db.WorkoutTemplates.Remove(w);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<WorkoutAssignment> CreateAssignmentAsync(WorkoutAssignment assignment)
    {
        db.WorkoutAssignments.Add(assignment);
        await db.SaveChangesAsync();
        return assignment;
    }

    public async Task<WorkoutLog> CreateLogAsync(WorkoutLog log)
    {
        log.CreatedAt = DateTime.UtcNow;
        db.WorkoutLogs.Add(log);
        await db.SaveChangesAsync();
        return log;
    }

    public async Task<List<WorkoutLog>> GetLogsByWorkoutAndClientAsync(ulong workoutId, ulong clientId) =>
        await db.WorkoutLogs
            .Where(l => l.TemplateId == workoutId && l.ClientId == clientId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
}
