using FluentValidation;
using GymManagmentApplication.Application.Onboarding.Requests;

namespace GymManagmentApplication.Application.Onboarding.Validators;

public class SubmitAssessmentValidator : AbstractValidator<SubmitAssessmentRequest>
{
    public SubmitAssessmentValidator()
    {
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.TemplateId).GreaterThan(0ul).WithMessage("TemplateId is required.");
        RuleFor(x => x.Responses).NotNull();
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
