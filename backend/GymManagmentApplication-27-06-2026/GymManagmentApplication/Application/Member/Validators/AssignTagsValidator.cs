using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class AssignTagsValidator : AbstractValidator<AssignTagsRequest>
{
    public AssignTagsValidator()
    {
        RuleFor(x => x.Tags).NotNull();
        RuleForEach(x => x.Tags).NotEmpty().MaximumLength(100);
    }
}
