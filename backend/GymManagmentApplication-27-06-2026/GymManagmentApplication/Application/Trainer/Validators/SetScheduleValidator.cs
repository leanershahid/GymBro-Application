using FluentValidation;
using GymManagmentApplication.Application.Trainer.Requests;

namespace GymManagmentApplication.Application.Trainer.Validators;

public class ScheduleSlotValidator : AbstractValidator<ScheduleSlotRequest>
{
    public ScheduleSlotValidator()
    {
        RuleFor(x => x.DayOfWeek).InclusiveBetween((byte)0, (byte)6)
            .WithMessage("DayOfWeek must be between 0 (Sunday) and 6 (Saturday).");
        RuleFor(x => x.EndTime).GreaterThan(x => x.StartTime)
            .WithMessage("EndTime must be after StartTime.");
    }
}

public class SetScheduleValidator : AbstractValidator<SetScheduleRequest>
{
    public SetScheduleValidator()
    {
        RuleFor(x => x.Slots).NotEmpty();
        RuleForEach(x => x.Slots).SetValidator(new ScheduleSlotValidator());
    }
}
