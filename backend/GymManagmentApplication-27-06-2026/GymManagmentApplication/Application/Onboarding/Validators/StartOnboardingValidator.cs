using FluentValidation;
using GymManagmentApplication.Application.Onboarding.Requests;

namespace GymManagmentApplication.Application.Onboarding.Validators;

public class StartOnboardingValidator : AbstractValidator<StartOnboardingRequest>
{
    public StartOnboardingValidator()
    {
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
    }
}
