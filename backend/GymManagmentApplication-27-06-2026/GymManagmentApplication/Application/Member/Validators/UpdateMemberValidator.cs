using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class UpdateMemberValidator : AbstractValidator<UpdateMemberRequest>
{
    public UpdateMemberValidator()
    {
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100).When(x => x.FirstName is not null);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100).When(x => x.LastName is not null);
        RuleFor(x => x.Phone).MaximumLength(30).When(x => x.Phone is not null);
        RuleFor(x => x.Gender).MaximumLength(20).When(x => x.Gender is not null);
        RuleFor(x => x.Dob).LessThan(DateOnly.FromDateTime(DateTime.Today)).When(x => x.Dob.HasValue);
        RuleFor(x => x.AvatarUrl).MaximumLength(500).When(x => x.AvatarUrl is not null);
        RuleFor(x => x.Notes).MaximumLength(2000).When(x => x.Notes is not null);
    }
}
