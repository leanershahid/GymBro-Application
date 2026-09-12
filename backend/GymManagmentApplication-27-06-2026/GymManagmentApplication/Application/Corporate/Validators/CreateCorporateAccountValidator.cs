using FluentValidation;
using GymManagmentApplication.Application.Corporate.Requests;

namespace GymManagmentApplication.Application.Corporate.Validators;

public class CreateCorporateAccountValidator : AbstractValidator<CreateCorporateAccountRequest>
{
    public CreateCorporateAccountValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ContactEmail).EmailAddress().When(x => x.ContactEmail is not null);
        RuleFor(x => x.MaxMembers).GreaterThan(0u).When(x => x.MaxMembers.HasValue);
    }
}
