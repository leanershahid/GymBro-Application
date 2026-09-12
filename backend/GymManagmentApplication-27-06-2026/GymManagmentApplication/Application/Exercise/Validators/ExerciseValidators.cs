using FluentValidation;
using GymManagmentApplication.Application.Exercise.Requests;

namespace GymManagmentApplication.Application.Exercise.Validators;

public class CreateExerciseValidator : AbstractValidator<CreateExerciseRequest>
{
    public CreateExerciseValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.Difficulty).IsInEnum();
    }
}

public class UpdateExerciseValidator : AbstractValidator<UpdateExerciseRequest>
{
    public UpdateExerciseValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200).When(x => x.Name is not null);
    }
}

public class AnnotateVideoValidator : AbstractValidator<AnnotateVideoRequest>
{
    public AnnotateVideoValidator()
    {
        RuleFor(x => x.Annotations).NotEmpty();
    }
}

public class ExerciseListValidator : AbstractValidator<ExerciseListRequest>
{
    public ExerciseListValidator()
    {
        RuleFor(x => x.Tag).MaximumLength(100);
        RuleFor(x => x.MuscleId).GreaterThan((ushort)0).When(x => x.MuscleId.HasValue);
        RuleFor(x => x.EquipmentId).GreaterThan((ushort)0).When(x => x.EquipmentId.HasValue);
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
