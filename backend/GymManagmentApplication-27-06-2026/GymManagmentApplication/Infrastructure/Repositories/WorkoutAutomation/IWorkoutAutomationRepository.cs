using GymManagmentApplication.Application.WorkoutAutomation.Requests;
using GymManagmentApplication.Domain.Entities.Training;

namespace GymManagmentApplication.Infrastructure.Repositories.WorkoutAutomation;

public interface IWorkoutAutomationRepository
{
    Task<List<WorkoutAutomationRule>> GetRulesAsync(ulong tenantId);
    Task<WorkoutAutomationRule> CreateRuleAsync(WorkoutAutomationRule rule);
    Task<WorkoutAutomationRule?> GetRuleByIdAsync(ulong id);
    Task<WorkoutAutomationRule?> UpdateRuleAsync(WorkoutAutomationRule rule);
    Task<bool> DeleteRuleAsync(ulong id);
    Task<WorkoutAutomationLog> CreateLogAsync(WorkoutAutomationLog log);
    Task<(List<WorkoutAutomationLog> Items, int Total)> GetLogsAsync(AutomationLogListRequest request);
}
