using FluentValidation;
using GymManagmentApplication.Application.WorkoutPlan.Requests;

namespace GymManagmentApplication.Application.WorkoutPlan.Validators;

public class CreatePlanValidator : AbstractValidator<CreatePlanRequest>
{
    public CreatePlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TenantId).GreaterThan(0ul);
        RuleFor(x => x.DurationWeeks).GreaterThan((byte)0);
        RuleFor(x => x.Goal).IsInEnum();
        RuleFor(x => x.Difficulty).IsInEnum();
    }
}

public class UpdatePlanValidator : AbstractValidator<UpdatePlanRequest>
{
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
    }
}

public class AssignPlanValidator : AbstractValidator<AssignPlanRequest>
{
    public AssignPlanValidator()
    {
        RuleFor(x => x.MemberIds).NotEmpty();
        RuleFor(x => x.StartDate).NotEmpty();
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

public class AddBranchValidator : AbstractValidator<AddBranchRequest>
{
    public AddBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Condition).NotNull();
        RuleFor(x => x.NextPlanId).Must(id => id is null || id > 0)
            .WithMessage("NextPlanId must be null or a valid plan id.");
    }
}

public class UpdateProgressionValidator : AbstractValidator<UpdateProgressionRequest>
{
    public UpdateProgressionValidator()
    {
        RuleFor(x => x.Rules).NotNull();
    }
}
