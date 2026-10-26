using FluentValidation;
using GymManagmentApplication.Application.Onboarding.Requests;

namespace GymManagmentApplication.Application.Onboarding.Validators;

public class CreateOnboardingTemplateValidator : AbstractValidator<CreateOnboardingTemplateRequest>
{
    public CreateOnboardingTemplateValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.Steps).NotEmpty();
        RuleForEach(x => x.Steps).SetValidator(new TemplateStepValidator());
    }
}
