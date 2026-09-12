using FluentValidation;
using GymManagmentApplication.Application.Corporate.Requests;

namespace GymManagmentApplication.Application.Corporate.Validators;

public class UpdateCorporateAccountValidator : AbstractValidator<UpdateCorporateAccountRequest>
{
    public UpdateCorporateAccountValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.ContactEmail).EmailAddress().When(x => x.ContactEmail is not null);
        RuleFor(x => x.ContactPhone).MaximumLength(30).When(x => x.ContactPhone is not null);
        RuleFor(x => x.MaxMembers).GreaterThan(0u).When(x => x.MaxMembers.HasValue);
        RuleFor(x => x.Status).MaximumLength(50).When(x => x.Status is not null);
    }
}
