using FluentValidation;
using GymManagmentApplication.Application.Billing.Requests;

namespace GymManagmentApplication.Application.Billing.Validators;

public class CreateMembershipPlanValidator : AbstractValidator<CreateMembershipPlanRequest>
{
    public CreateMembershipPlanValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.BillingCycle).Must(v => v is "monthly" or "quarterly" or "annual")
            .WithMessage("BillingCycle must be one of: monthly, quarterly, annual.");
        RuleFor(x => x.DurationDays).GreaterThan(0);
    }
}

public class UpdateMembershipPlanValidator : AbstractValidator<UpdateMembershipPlanRequest>
{
    public UpdateMembershipPlanValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.Description).MaximumLength(2000).When(x => x.Description is not null);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).When(x => x.Price.HasValue);
        RuleFor(x => x.BillingCycle).Must(v => v is "monthly" or "quarterly" or "annual")
            .When(x => x.BillingCycle is not null)
            .WithMessage("BillingCycle must be one of: monthly, quarterly, annual.");
        RuleFor(x => x.DurationDays).GreaterThan(0).When(x => x.DurationDays.HasValue);
    }
}

public class UpdatePlanFeaturesValidator : AbstractValidator<UpdatePlanFeaturesRequest>
{
    public UpdatePlanFeaturesValidator()
    {
        RuleFor(x => x.Features).NotNull();
        RuleForEach(x => x.Features).NotEmpty().MaximumLength(200);
    }
}

public class CreateSubscriptionValidator : AbstractValidator<CreateSubscriptionRequest>
{
    public CreateSubscriptionValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.PlanId).GreaterThan(0ul).WithMessage("PlanId is required.");
        RuleFor(x => x.StartDate).NotEmpty();
        RuleFor(x => x.PaymentMethodId).Must(id => id is null || id > 0)
            .WithMessage("PaymentMethodId must be null or a valid id.");
    }
}

public class FreezeSubscriptionValidator : AbstractValidator<FreezeSubscriptionRequest>
{
    public FreezeSubscriptionValidator()
    {
        RuleFor(x => x.FreezeFrom).NotEmpty();
        RuleFor(x => x.FreezeUntil).NotEmpty();
        RuleFor(x => x.FreezeUntil).GreaterThan(x => x.FreezeFrom)
            .WithMessage("FreezeUntil must be after FreezeFrom.");
        RuleFor(x => x.Reason).MaximumLength(500);
    }
}

public class UpgradeDowngradeValidator : AbstractValidator<UpgradeDowngradeRequest>
{
    public UpgradeDowngradeValidator()
    {
        RuleFor(x => x.NewPlanId).GreaterThan(0ul).WithMessage("NewPlanId is required.");
    }
}

public class ChargeValidator : AbstractValidator<ChargeRequest>
{
    public ChargeValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.PaymentMethodId).Must(id => id is null || id > 0)
            .WithMessage("PaymentMethodId must be null or a valid id.");
    }
}

public class RefundValidator : AbstractValidator<RefundRequest>
{
    public RefundValidator()
    {
        RuleFor(x => x.PaymentId).GreaterThan(0ul).WithMessage("PaymentId is required.");
        RuleFor(x => x.Amount).GreaterThan(0).When(x => x.Amount.HasValue);
        RuleFor(x => x.Reason).MaximumLength(500);
    }
}

public class SavePaymentMethodValidator : AbstractValidator<SavePaymentMethodRequest>
{
    public SavePaymentMethodValidator()
    {
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.Type).NotEmpty().Must(v => v is "card" or "upi" or "bank-account")
            .WithMessage("Type must be one of: card, upi, bank-account.");
        RuleFor(x => x.Provider).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Token).NotEmpty();
    }
}

public class CreatePaymentIntentValidator : AbstractValidator<CreatePaymentIntentRequest>
{
    public CreatePaymentIntentValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.Provider).NotEmpty().MaximumLength(50);
    }
}

public class PaymentReminderValidator : AbstractValidator<PaymentReminderRequest>
{
    public PaymentReminderValidator()
    {
        RuleFor(x => x.MemberId).GreaterThan(0ul).WithMessage("MemberId is required.");
        RuleFor(x => x.Message).MaximumLength(1000);
        RuleFor(x => x.Channel).NotEmpty().Must(v => v is "email" or "sms" or "push")
            .WithMessage("Channel must be one of: email, sms, push.");
    }
}
