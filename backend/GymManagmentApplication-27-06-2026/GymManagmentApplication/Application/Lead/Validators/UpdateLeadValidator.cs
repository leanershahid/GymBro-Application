using FluentValidation;
using GymManagmentApplication.Application.Lead.Requests;

namespace GymManagmentApplication.Application.Lead.Validators;

public class UpdateLeadValidator : AbstractValidator<UpdateLeadRequest>
{
    public UpdateLeadValidator()
    {
        RuleFor(x => x.Email).EmailAddress().When(x => x.Email is not null);
        RuleFor(x => x.FirstName).MaximumLength(100);
        RuleFor(x => x.LastName).MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.Source).MaximumLength(100);
        RuleFor(x => x.Status).MaximumLength(50);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
