using FluentValidation;
using GymManagmentApplication.Application.Onboarding.Requests;

namespace GymManagmentApplication.Application.Onboarding.Validators;

public class TemplateStepValidator : AbstractValidator<TemplateStepRequest>
{
    public TemplateStepValidator()
    {
        RuleFor(x => x.StepKey).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Label).NotEmpty().MaximumLength(200);
    }
}
