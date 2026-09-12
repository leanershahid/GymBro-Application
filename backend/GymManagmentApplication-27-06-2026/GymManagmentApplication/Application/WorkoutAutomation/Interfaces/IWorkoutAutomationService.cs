using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutAutomation.Requests;
using GymManagmentApplication.Application.WorkoutAutomation.Responses;

namespace GymManagmentApplication.Application.WorkoutAutomation.Interfaces;

public interface IWorkoutAutomationService
{
    Task<List<AutomationRuleResponse>> GetRulesAsync(ulong tenantId);
    Task<AutomationRuleResponse> CreateRuleAsync(CreateAutomationRuleRequest request);
    Task<AutomationRuleResponse?> UpdateRuleAsync(ulong id, UpdateAutomationRuleRequest request);
    Task<bool> DeleteRuleAsync(ulong id);
    Task<TriggerResultResponse> TriggerAsync(TriggerAutomationRequest request);
    Task<PagedResponse<AutomationLogResponse>> GetLogsAsync(AutomationLogListRequest request);
}
