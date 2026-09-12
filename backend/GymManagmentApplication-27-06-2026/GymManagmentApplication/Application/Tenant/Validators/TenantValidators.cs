using FluentValidation;
using GymManagmentApplication.Application.Tenant.Requests;

namespace GymManagmentApplication.Application.Tenant.Validators;

public class CreateTenantValidator : AbstractValidator<CreateTenantRequest>
{
    public CreateTenantValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100)
            .Matches("^[a-z0-9-]+$").WithMessage("Slug must be lowercase alphanumeric with hyphens.");
    }
}

public class UpdateTenantValidator : AbstractValidator<UpdateTenantRequest>
{
    public UpdateTenantValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.LogoUrl).MaximumLength(500).When(x => x.LogoUrl is not null);
        RuleFor(x => x.PrimaryColor).MaximumLength(20).When(x => x.PrimaryColor is not null);
        RuleFor(x => x.Timezone).MaximumLength(100).When(x => x.Timezone is not null);
        RuleFor(x => x.Locale).MaximumLength(20).When(x => x.Locale is not null);
        RuleFor(x => x.Currency).Length(3).When(x => x.Currency is not null);
        RuleFor(x => x.CustomDomain).MaximumLength(255).When(x => x.CustomDomain is not null);
        RuleFor(x => x.Status).IsInEnum().When(x => x.Status.HasValue);
        RuleFor(x => x.Plan).IsInEnum().When(x => x.Plan.HasValue);
    }
}
