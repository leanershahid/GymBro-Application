using FluentValidation;
using GymManagmentApplication.Application.WorkoutBuilder.Requests;

namespace GymManagmentApplication.Application.WorkoutBuilder.Validators;

public class AddCircuitValidator : AbstractValidator<AddCircuitRequest>
{
    public AddCircuitValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200);
        RuleFor(x => x.Rounds).GreaterThan((byte)0);
        RuleFor(x => x.ExerciseIds).NotEmpty();
    }
}

public class UpdateCircuitValidator : AbstractValidator<UpdateCircuitRequest>
{
    public UpdateCircuitValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.Rounds).GreaterThan((byte)0).When(x => x.Rounds.HasValue);
    }
}

public class AddSupersetValidator : AbstractValidator<AddSupersetRequest>
{
    public AddSupersetValidator()
    {
        RuleFor(x => x.ExerciseIds).NotEmpty().Must(x => x.Count >= 2)
            .WithMessage("A superset requires at least two exercises.");
        RuleFor(x => x.Sets).GreaterThan((byte)0);
    }
}

public class DropsetStepValidator : AbstractValidator<DropsetStep>
{
    public DropsetStepValidator()
    {
        RuleFor(x => x.Weight).NotEmpty();
        RuleFor(x => x.Reps).GreaterThan((ushort)0);
    }
}

public class AddDropsetValidator : AbstractValidator<AddDropsetRequest>
{
    public AddDropsetValidator()
    {
        RuleFor(x => x.ExerciseId).GreaterThan(0ul).WithMessage("ExerciseId is required.");
        RuleFor(x => x.Steps).NotEmpty();
        RuleForEach(x => x.Steps).SetValidator(new DropsetStepValidator());
    }
}

public class PyramidStepValidator : AbstractValidator<PyramidStep>
{
    public PyramidStepValidator()
    {
        RuleFor(x => x.Weight).NotEmpty();
        RuleFor(x => x.Reps).GreaterThan((ushort)0);
    }
}

public class AddPyramidValidator : AbstractValidator<AddPyramidRequest>
{
    public AddPyramidValidator()
    {
        RuleFor(x => x.ExerciseId).GreaterThan(0ul).WithMessage("ExerciseId is required.");
        RuleFor(x => x.Direction).NotEmpty().Must(v => v is "ascending" or "descending")
            .WithMessage("Direction must be one of: ascending, descending.");
        RuleFor(x => x.Steps).NotEmpty();
        RuleForEach(x => x.Steps).SetValidator(new PyramidStepValidator());
    }
}

public class SetTempoValidator : AbstractValidator<SetTempoRequest>
{
    public SetTempoValidator()
    {
        RuleFor(x => x.ExerciseIds).NotEmpty();
        RuleFor(x => x.Tempo).NotEmpty().MaximumLength(20);
    }
}

public class SetRestIntervalsValidator : AbstractValidator<SetRestIntervalsRequest>
{
    public SetRestIntervalsValidator()
    {
        RuleFor(x => x.DefaultRestSeconds).GreaterThan((ushort)0);
    }
}

public class ConfigureTimerValidator : AbstractValidator<ConfigureTimerRequest>
{
    public ConfigureTimerValidator()
    {
        RuleFor(x => x.TimerType).NotEmpty().Must(v => v is "standard" or "interval" or "tabata" or "amrap" or "emom")
            .WithMessage("TimerType must be one of: standard, interval, tabata, amrap, emom.");
        RuleFor(x => x.WorkSeconds).GreaterThan((ushort)0).When(x => x.WorkSeconds.HasValue);
        RuleFor(x => x.RestSeconds).GreaterThan((ushort)0).When(x => x.RestSeconds.HasValue);
        RuleFor(x => x.Rounds).GreaterThan((byte)0).When(x => x.Rounds.HasValue);
    }
}

public class SetDifficultyValidator : AbstractValidator<SetDifficultyRequest>
{
    public SetDifficultyValidator()
    {
        RuleFor(x => x.Mode).NotEmpty().Must(v => v is "manual" or "auto")
            .WithMessage("Mode must be one of: manual, auto.");
        RuleFor(x => x.BaseDifficulty).IsInEnum();
        RuleFor(x => x.ProgressionThresholdPercent).InclusiveBetween((byte)0, (byte)100)
            .When(x => x.ProgressionThresholdPercent.HasValue);
    }
}
