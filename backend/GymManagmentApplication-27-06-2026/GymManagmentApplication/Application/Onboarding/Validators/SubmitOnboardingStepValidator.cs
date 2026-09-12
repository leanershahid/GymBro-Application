using FluentValidation;
using GymManagmentApplication.Application.Onboarding.Requests;

namespace GymManagmentApplication.Application.Onboarding.Validators;

public class SubmitOnboardingStepValidator : AbstractValidator<SubmitOnboardingStepRequest>
{
    public SubmitOnboardingStepValidator()
    {
        RuleFor(x => x.StepKey).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Data).NotNull();
    }
}
