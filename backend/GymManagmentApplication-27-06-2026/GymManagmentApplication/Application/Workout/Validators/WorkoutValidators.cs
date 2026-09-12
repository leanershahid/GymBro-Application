using FluentValidation;
using GymManagmentApplication.Application.Workout.Requests;

namespace GymManagmentApplication.Application.Workout.Validators;

public class CreateWorkoutValidator : AbstractValidator<CreateWorkoutRequest>
{
    public CreateWorkoutValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TenantId).GreaterThan(0ul);
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
        RuleFor(x => x.ClientId).GreaterThan(0ul);
        RuleFor(x => x.StartedAt).NotEmpty();
        RuleFor(x => x.EndedAt).GreaterThan(x => x.StartedAt);
    }
}
