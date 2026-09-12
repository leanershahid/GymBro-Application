using FluentValidation;
using GymManagmentApplication.Application.Lead.Requests;

namespace GymManagmentApplication.Application.Lead.Validators;

public class LeadListValidator : AbstractValidator<LeadListRequest>
{
    public LeadListValidator()
    {
        RuleFor(x => x.TenantId).Must(id => id is null || id > 0)
            .WithMessage("TenantId must be null or a valid id.");
        RuleFor(x => x.Status).MaximumLength(50);
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
