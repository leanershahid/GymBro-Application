using FluentValidation;
using GymManagmentApplication.Application.Billing.Requests;

namespace GymManagmentApplication.Application.Billing.Validators;

public class InvoiceLineItemValidator : AbstractValidator<InvoiceLineItem>
{
    public InvoiceLineItemValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(500);
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}

public class GenerateInvoiceValidator : AbstractValidator<GenerateInvoiceRequest>
{
    public GenerateInvoiceValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.Items).NotEmpty();
        RuleForEach(x => x.Items).SetValidator(new InvoiceLineItemValidator());
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public class SendInvoiceValidator : AbstractValidator<SendInvoiceRequest>
{
    public SendInvoiceValidator()
    {
        RuleFor(x => x.AdditionalMessage).MaximumLength(1000);
    }
}

public class InvoiceListValidator : AbstractValidator<InvoiceListRequest>
{
    public InvoiceListValidator()
    {
        RuleFor(x => x.TenantId).Must(id => id is null || id > 0)
            .WithMessage("TenantId must be null or a valid id.");
        RuleFor(x => x.MemberId).Must(id => id is null || id > 0)
            .WithMessage("MemberId must be null or a valid id.");
        RuleFor(x => x.Status).Must(v => v is null or "paid" or "unpaid" or "overdue")
            .WithMessage("Status must be one of: paid, unpaid, overdue.");
        RuleFor(x => x.PageNumber).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

public class CreatePricingRuleValidator : AbstractValidator<CreatePricingRuleRequest>
{
    public CreatePricingRuleValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.RuleType).NotEmpty().Must(v => v is "time-based" or "demand-based" or "promotional")
            .WithMessage("RuleType must be one of: time-based, demand-based, promotional.");
        RuleFor(x => x.ModifierType).NotEmpty().Must(v => v is "percentage" or "fixed")
            .WithMessage("ModifierType must be one of: percentage, fixed.");
        RuleFor(x => x.ValidUntil).GreaterThan(x => x.ValidFrom)
            .When(x => x.ValidFrom.HasValue && x.ValidUntil.HasValue)
            .WithMessage("ValidUntil must be after ValidFrom.");
    }
}

public class UpdatePricingRuleValidator : AbstractValidator<UpdatePricingRuleRequest>
{
    public UpdatePricingRuleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.ValidUntil).GreaterThan(x => x.ValidFrom)
            .When(x => x.ValidFrom.HasValue && x.ValidUntil.HasValue)
            .WithMessage("ValidUntil must be after ValidFrom.");
    }
}

public class CalculatePriceValidator : AbstractValidator<CalculatePriceRequest>
{
    public CalculatePriceValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.PlanId).GreaterThan(0ul).WithMessage("PlanId is required.");
        RuleFor(x => x.MemberId).Must(id => id is null || id > 0)
            .WithMessage("MemberId must be null or a valid id.");
        RuleFor(x => x.DiscountCode).MaximumLength(50);
    }
}

public class CreateDiscountValidator : AbstractValidator<CreateDiscountRequest>
{
    public CreateDiscountValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.DiscountType).NotEmpty().Must(v => v is "percentage" or "fixed")
            .WithMessage("DiscountType must be one of: percentage, fixed.");
        RuleFor(x => x.Value).GreaterThan(0);
        RuleFor(x => x.MaxUses).GreaterThan(0).When(x => x.MaxUses.HasValue);
    }
}

public class ValidateDiscountValidator : AbstractValidator<ValidateDiscountRequest>
{
    public ValidateDiscountValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.PlanId).GreaterThan(0ul).WithMessage("PlanId is required.");
        RuleFor(x => x.MemberId).Must(id => id is null || id > 0)
            .WithMessage("MemberId must be null or a valid id.");
    }
}
