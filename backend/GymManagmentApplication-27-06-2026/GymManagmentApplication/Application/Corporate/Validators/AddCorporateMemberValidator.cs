using FluentValidation;
using GymManagmentApplication.Application.Corporate.Requests;

namespace GymManagmentApplication.Application.Corporate.Validators;

public class AddCorporateMemberValidator : AbstractValidator<AddCorporateMemberRequest>
{
    public AddCorporateMemberValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0ul).WithMessage("UserId is required.");
        RuleFor(x => x.PlanId).GreaterThan(0ul).WithMessage("PlanId is required.");
        RuleFor(x => x.StartsAt).NotEmpty();
    }
}
