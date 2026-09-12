using FluentValidation;
using GymManagmentApplication.Application.Challenges.Requests;

namespace GymManagmentApplication.Application.Challenges.Validators;

public class CreateChallengeValidator : AbstractValidator<CreateChallengeRequest>
{
    public CreateChallengeValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0UL);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.EndsAt).GreaterThan(x => x.StartsAt);
        RuleFor(x => x.TargetValue).GreaterThan(0).When(x => x.TargetValue.HasValue);
    }
}
