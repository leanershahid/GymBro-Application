using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class AddMemberNoteValidator : AbstractValidator<AddMemberNoteRequest>
{
    public AddMemberNoteValidator()
    {
        RuleFor(x => x.Note).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.TrainerId).GreaterThan(0ul).WithMessage("TrainerId is required.");
    }
}
