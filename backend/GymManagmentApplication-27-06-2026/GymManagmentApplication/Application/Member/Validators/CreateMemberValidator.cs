using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class CreateMemberValidator : AbstractValidator<CreateMemberRequest>
{
    public CreateMemberValidator()
    {
        RuleFor(x => x.BranchId).GreaterThan(0ul).When(x => x.BranchId.HasValue);
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Dob).LessThan(DateOnly.FromDateTime(DateTime.Today)).When(x => x.Dob.HasValue);
    }
}
