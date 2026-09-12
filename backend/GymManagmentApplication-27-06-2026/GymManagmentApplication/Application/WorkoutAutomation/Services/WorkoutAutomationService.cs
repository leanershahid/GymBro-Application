using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.WorkoutAutomation.Interfaces;
using GymManagmentApplication.Application.WorkoutAutomation.Requests;
using GymManagmentApplication.Application.WorkoutAutomation.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.WorkoutAutomation;

namespace GymManagmentApplication.Application.WorkoutAutomation.Services;

public class WorkoutAutomationService(IWorkoutAutomationRepository repository) : IWorkoutAutomationService
{
    public async Task<List<AutomationRuleResponse>> GetRulesAsync(ulong tenantId)
    {
        var rules = await repository.GetRulesAsync(tenantId);
        return rules.Select(MapRule).ToList();
    }

    public async Task<AutomationRuleResponse> CreateRuleAsync(CreateAutomationRuleRequest request)
    {
        var rule = new WorkoutAutomationRule
        {
            TenantId = request.TenantId,
            Name = request.Name,
            TriggerEvent = request.TriggerEvent,
            Conditions = request.Conditions,
            Actions = request.Actions
        };
        return MapRule(await repository.CreateRuleAsync(rule));
    }

    public async Task<AutomationRuleResponse?> UpdateRuleAsync(ulong id, UpdateAutomationRuleRequest request)
    {
        var rule = await repository.GetRuleByIdAsync(id);
        if (rule is null) return null;
        if (request.Name is not null) rule.Name = request.Name;
        if (request.TriggerEvent is not null) rule.TriggerEvent = request.TriggerEvent;
        if (request.Conditions is not null) rule.Conditions = request.Conditions;
        if (request.Actions is not null) rule.Actions = request.Actions;
        if (request.IsActive.HasValue) rule.IsActive = request.IsActive.Value;
        await repository.UpdateRuleAsync(rule);
        return MapRule(rule);
    }

    public Task<bool> DeleteRuleAsync(ulong id) => repository.DeleteRuleAsync(id);

    public async Task<TriggerResultResponse> TriggerAsync(TriggerAutomationRequest request)
    {
        var rule = await repository.GetRuleByIdAsync(request.RuleId);
        if (rule is null)
            return new TriggerResultResponse { RuleId = request.RuleId, Status = "Failed", Message = "Rule not found.", TriggeredAt = DateTime.UtcNow };

        rule.RunCount++;
        rule.LastRunAt = DateTime.UtcNow;
        await repository.UpdateRuleAsync(rule);

        var log = new WorkoutAutomationLog
        {
            RuleId = request.RuleId,
            TargetUserId = request.TargetUserId,
            Status = AutomationLogStatus.Success,
            ExecutedAt = DateTime.UtcNow
        };
        await repository.CreateLogAsync(log);

        return new TriggerResultResponse
        {
            RuleId = request.RuleId,
            Status = "Success",
            Message = $"Rule '{rule.Name}' triggered successfully.",
            TriggeredAt = DateTime.UtcNow
        };
    }

    public async Task<PagedResponse<AutomationLogResponse>> GetLogsAsync(AutomationLogListRequest request)
    {
        var (items, total) = await repository.GetLogsAsync(request);
        return new PagedResponse<AutomationLogResponse>
        {
            Items = items.Select(l => new AutomationLogResponse
            {
                Id = l.Id,
                RuleId = l.RuleId,
                RuleName = l.Rule?.Name ?? string.Empty,
                TargetUserId = l.TargetUserId,
                Status = l.Status.ToString(),
                ExecutedAt = l.ExecutedAt
            }),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    private static AutomationRuleResponse MapRule(WorkoutAutomationRule r) => new()
    {
        Id = r.Id,
        TenantId = r.TenantId,
        Name = r.Name,
        TriggerEvent = r.TriggerEvent,
        IsActive = r.IsActive,
        RunCount = r.RunCount,
        LastRunAt = r.LastRunAt,
        CreatedAt = r.CreatedAt
    };
}
