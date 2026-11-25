using FluentValidation;
using GymManagmentApplication.Application.WorkoutPlan.Requests;

namespace GymManagmentApplication.Application.WorkoutPlan.Validators;

public class CreatePlanValidator : AbstractValidator<CreatePlanRequest>
{
    public CreatePlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.DurationWeeks).InclusiveBetween((byte)1, (byte)52);
        RuleFor(x => x.DaysPerWeekHint).InclusiveBetween((byte)1, (byte)7).When(x => x.DaysPerWeekHint.HasValue);
        RuleFor(x => x.Goal).IsInEnum();
        RuleFor(x => x.Difficulty).IsInEnum();
    }
}

public class UpdatePlanValidator : AbstractValidator<UpdatePlanRequest>
{
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.DurationWeeks).InclusiveBetween((byte)1, (byte)52).When(x => x.DurationWeeks.HasValue);
        RuleFor(x => x.DaysPerWeekHint).InclusiveBetween((byte)0, (byte)7).When(x => x.DaysPerWeekHint.HasValue);
    }
}

public class AssignPlanValidator : AbstractValidator<AssignPlanRequest>
{
    public AssignPlanValidator()
    {
        RuleFor(x => x.MemberIds).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.StartWeek).InclusiveBetween((byte)1, (byte)52);
        RuleFor(x => x.StartDay).InclusiveBetween((byte)1, (byte)7);
    }
}

public class PlanListValidator : AbstractValidator<PlanListRequest>
{
    public PlanListValidator()
    {
        RuleFor(x => x.TenantId).Must(id => id is null || id > 0)
            .WithMessage("TenantId must be null or a valid id.");
        RuleFor(x => x.Goal).IsInEnum().When(x => x.Goal.HasValue);
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
