using FluentValidation;
using GymManagmentApplication.Application.Trainer.Requests;

namespace GymManagmentApplication.Application.Trainer.Validators;

public class AssignClientValidator : AbstractValidator<AssignClientRequest>
{
    public AssignClientValidator()
    {
        RuleFor(x => x.ClientId).GreaterThan(0ul).WithMessage("ClientId is required.");
        RuleFor(x => x.BranchId).GreaterThan(0ul).WithMessage("BranchId is required.");
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
