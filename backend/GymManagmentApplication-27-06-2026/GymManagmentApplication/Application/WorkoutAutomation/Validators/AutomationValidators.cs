using FluentValidation;
using GymManagmentApplication.Application.WorkoutAutomation.Requests;

namespace GymManagmentApplication.Application.WorkoutAutomation.Validators;

public class CreateAutomationRuleValidator : AbstractValidator<CreateAutomationRuleRequest>
{
    public CreateAutomationRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TenantId).GreaterThan(0ul);
        RuleFor(x => x.TriggerEvent).NotEmpty();
        RuleFor(x => x.Actions).NotNull();
    }
}

public class TriggerAutomationValidator : AbstractValidator<TriggerAutomationRequest>
{
    public TriggerAutomationValidator()
    {
        RuleFor(x => x.RuleId).GreaterThan(0ul);
    }
}

public class UpdateAutomationRuleValidator : AbstractValidator<UpdateAutomationRuleRequest>
{
    public UpdateAutomationRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.TriggerEvent).NotEmpty().When(x => x.TriggerEvent is not null);
    }
}

public class AutomationLogListValidator : AbstractValidator<AutomationLogListRequest>
{
    public AutomationLogListValidator()
    {
        RuleFor(x => x.RuleId).Must(id => id is null || id > 0)
            .WithMessage("RuleId must be null or a valid id.");
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
