using FluentValidation;
using GymManagmentApplication.Application.Corporate.Requests;

namespace GymManagmentApplication.Application.Corporate.Validators;

public class CorporateAccountListValidator : AbstractValidator<CorporateAccountListRequest>
{
    public CorporateAccountListValidator()
    {
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
