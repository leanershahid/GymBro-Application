using FluentValidation;
using GymManagmentApplication.Application.Workout.Requests;

namespace GymManagmentApplication.Application.Workout.Validators;

public class CreateWorkoutValidator : AbstractValidator<CreateWorkoutRequest>
{
    public CreateWorkoutValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Goal).IsInEnum();
        RuleFor(x => x.Difficulty).IsInEnum();
    }
}

public class UpdateWorkoutValidator : AbstractValidator<UpdateWorkoutRequest>
{
    public UpdateWorkoutValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
    }
}

public class AssignWorkoutValidator : AbstractValidator<AssignWorkoutRequest>
{
    public AssignWorkoutValidator()
    {
        RuleFor(x => x.WorkoutId).GreaterThan(0ul);
        RuleFor(x => x.MemberIds).NotEmpty();
    }
}

public class CompleteWorkoutValidator : AbstractValidator<CompleteWorkoutRequest>
{
    public CompleteWorkoutValidator()
    {
        RuleFor(x => x.StartedAt).NotEmpty();
        RuleFor(x => x.EndedAt).GreaterThan(x => x.StartedAt);
        RuleFor(x => x.EndedAt).Must((x, end) => (end - x.StartedAt).TotalHours <= 24).WithMessage("A session can't be longer than 24 hours.");
        RuleFor(x => x.SessionRpe).InclusiveBetween((byte)1, (byte)10).When(x => x.SessionRpe.HasValue);
        RuleFor(x => x.Week).InclusiveBetween((byte)1, (byte)52).When(x => x.Week.HasValue);
        RuleFor(x => x.Day).InclusiveBetween((byte)1, (byte)7).When(x => x.Day.HasValue);
        RuleFor(x => x.Sets.Count).LessThanOrEqualTo(300).WithMessage("At most 300 sets per session.");
        RuleForEach(x => x.Sets).ChildRules(s =>
        {
            s.RuleFor(x => x.ExerciseId).GreaterThan(0ul);
            s.RuleFor(x => x.SetNo).InclusiveBetween((byte)1, (byte)50);
            s.RuleFor(x => x.SetType).Must(t => t is null || GymManagmentApplication.Application.Training.SetTypes.TryParse(t, out _))
                .WithMessage("Set type must be normal, warmup, drop or failure.");
            s.RuleFor(x => x.Reps).LessThanOrEqualTo((ushort)1000).When(x => x.Reps.HasValue);
            s.RuleFor(x => x.WeightKg).InclusiveBetween(0m, 1000m).When(x => x.WeightKg.HasValue);
            s.RuleFor(x => x.DurationSec).InclusiveBetween(0, 36000).When(x => x.DurationSec.HasValue);
            s.RuleFor(x => x.DistanceM).InclusiveBetween(0m, 100000m).When(x => x.DistanceM.HasValue);
            s.RuleFor(x => x.Rpe).InclusiveBetween(1m, 10m).When(x => x.Rpe.HasValue);
        });
    }
}
