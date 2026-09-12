using GymManagmentApplication.Application.WorkoutAutomation.Requests;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.WorkoutAutomation;

public class WorkoutAutomationRepository(AppDbContext db) : IWorkoutAutomationRepository
{
    public async Task<List<WorkoutAutomationRule>> GetRulesAsync(ulong tenantId) =>
        await db.WorkoutAutomationRules
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.Name)
            .ToListAsync();

    public async Task<WorkoutAutomationRule> CreateRuleAsync(WorkoutAutomationRule rule)
    {
        var maxId = await db.WorkoutAutomationRules.MaxAsync(r => (ulong?)r.Id) ?? 0;
        rule.Id        = maxId + 1;
        rule.CreatedAt = DateTime.UtcNow;
        rule.UpdatedAt = DateTime.UtcNow;
        db.WorkoutAutomationRules.Add(rule);
        await db.SaveChangesAsync();
        return rule;
    }

    public async Task<WorkoutAutomationRule?> GetRuleByIdAsync(ulong id) =>
        await db.WorkoutAutomationRules.FindAsync(id);

    public async Task<WorkoutAutomationRule?> UpdateRuleAsync(WorkoutAutomationRule rule)
    {
        var existing = await db.WorkoutAutomationRules.FindAsync(rule.Id);
        if (existing is null) return null;
        rule.UpdatedAt = DateTime.UtcNow;
        db.WorkoutAutomationRules.Update(rule);
        await db.SaveChangesAsync();
        return rule;
    }

    public async Task<bool> DeleteRuleAsync(ulong id)
    {
        var r = await db.WorkoutAutomationRules.FindAsync(id);
        if (r is null) return false;
        r.IsActive  = false;
        r.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<WorkoutAutomationLog> CreateLogAsync(WorkoutAutomationLog log)
    {
        var maxId = await db.WorkoutAutomationLogs.MaxAsync(l => (ulong?)l.Id) ?? 0;
        log.Id          = maxId + 1;
        log.ExecutedAt  = DateTime.UtcNow;
        db.WorkoutAutomationLogs.Add(log);
        await db.SaveChangesAsync();
        return log;
    }

    public async Task<(List<WorkoutAutomationLog> Items, int Total)> GetLogsAsync(AutomationLogListRequest request)
    {
        var q = db.WorkoutAutomationLogs.AsQueryable();

        if (request.RuleId.HasValue)
            q = q.Where(l => l.RuleId == request.RuleId.Value);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(l => l.ExecutedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return (items, total);
    }
}
