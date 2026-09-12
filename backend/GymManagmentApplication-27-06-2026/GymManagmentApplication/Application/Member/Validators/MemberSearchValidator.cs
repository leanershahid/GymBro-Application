using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class MemberSearchValidator : AbstractValidator<MemberSearchRequest>
{
    public MemberSearchValidator()
    {
        RuleFor(x => x.Query).MaximumLength(200);
        RuleFor(x => x.Status).MaximumLength(50);
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
