using FluentValidation;
using GymManagmentApplication.Application.Trainer.Requests;

namespace GymManagmentApplication.Application.Trainer.Validators;

public class UpdateTrainerValidator : AbstractValidator<UpdateTrainerRequest>
{
    public UpdateTrainerValidator()
    {
        RuleFor(x => x.DisplayName).MaximumLength(200).When(x => x.DisplayName is not null);
        RuleFor(x => x.Bio).MaximumLength(2000).When(x => x.Bio is not null);
        RuleFor(x => x.Phone).MaximumLength(30).When(x => x.Phone is not null);
        RuleFor(x => x.Email).EmailAddress().When(x => x.Email is not null);
        RuleFor(x => x.ProfileImage).MaximumLength(500).When(x => x.ProfileImage is not null);
    }
}
