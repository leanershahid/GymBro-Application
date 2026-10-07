using FluentValidation;
using GymManagmentApplication.Application.Trainer.Requests;

namespace GymManagmentApplication.Application.Trainer.Validators;

public class CreateTrainerValidator : AbstractValidator<CreateTrainerRequest>
{
    public CreateTrainerValidator()
    {
        RuleFor(x => x.BranchId).GreaterThan(0ul).WithMessage("BranchId is required.");
        RuleFor(x => x.TrainerCode).NotEmpty().WithMessage("TrainerCode is required.");
        // The trainer signs in with this email, so it is mandatory.
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.ExperienceYears).InclusiveBetween((byte)0, (byte)60).When(x => x.ExperienceYears.HasValue);
        RuleFor(x => x.DateOfBirth).LessThan(DateOnly.FromDateTime(DateTime.Today)).When(x => x.DateOfBirth.HasValue);


    }
}
