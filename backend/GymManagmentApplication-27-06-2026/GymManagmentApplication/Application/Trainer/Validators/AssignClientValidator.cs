using FluentValidation;
using GymManagmentApplication.Application.Trainer.Requests;

namespace GymManagmentApplication.Application.Trainer.Validators;

public class AssignClientValidator : AbstractValidator<AssignClientRequest>
{
    public AssignClientValidator()
    {
        RuleFor(x => x.ClientId).GreaterThan(0ul).WithMessage("ClientId is required.");
        // BranchId is optional: it defaults to the trainer's branch.
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}
