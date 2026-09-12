using FluentValidation;
using GymManagmentApplication.Application.Lead.Requests;

namespace GymManagmentApplication.Application.Lead.Validators;

public class LeadFollowupValidator : AbstractValidator<LeadFollowupRequest>
{
    public LeadFollowupValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.Outcome).MaximumLength(500);
        RuleFor(x => x.ActivityType).NotEmpty().MaximumLength(50);
    }
}
