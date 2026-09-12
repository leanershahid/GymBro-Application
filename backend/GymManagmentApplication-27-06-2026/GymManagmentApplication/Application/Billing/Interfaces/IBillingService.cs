using GymManagmentApplication.Application.Billing.Requests;
using GymManagmentApplication.Application.Billing.Responses;
using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Application.Billing.Interfaces;

public interface IMembershipPlanService
{
    Task<List<MembershipPlanResponse>> GetAllAsync(ulong tenantId);
    Task<MembershipPlanResponse> CreateAsync(CreateMembershipPlanRequest request);
    Task<MembershipPlanResponse?> GetByIdAsync(ulong id);
    Task<MembershipPlanResponse?> UpdateAsync(ulong id, UpdateMembershipPlanRequest request);
    Task<bool> ArchiveAsync(ulong id);
    Task<List<string>> GetFeaturesAsync(ulong id);
    Task<MembershipPlanResponse?> UpdateFeaturesAsync(ulong id, UpdatePlanFeaturesRequest request);
}

public interface ISubscriptionService
{
    Task<PagedResponse<SubscriptionResponse>> GetAllAsync(ulong tenantId, int page, int size);
    Task<SubscriptionResponse> CreateAsync(CreateSubscriptionRequest request);
    Task<SubscriptionResponse?> GetByIdAsync(ulong id);
    Task<SubscriptionResponse?> RenewAsync(ulong id);
    Task<SubscriptionResponse?> UpgradeAsync(ulong id, UpgradeDowngradeRequest request);
    Task<SubscriptionResponse?> DowngradeAsync(ulong id, UpgradeDowngradeRequest request);
    Task<SubscriptionResponse?> FreezeAsync(ulong id, FreezeSubscriptionRequest request);
    Task<SubscriptionResponse?> UnfreezeAsync(ulong id);
    Task<bool> CancelAsync(ulong id);
    Task<SubscriptionUsageResponse?> GetUsageAsync(ulong id);
}

public interface IPaymentService
{
    Task<PaymentResponse> ChargeAsync(ChargeRequest request);
    Task<PaymentResponse?> GetByIdAsync(ulong id);
    Task<PaymentResponse?> RefundAsync(RefundRequest request);
    Task<PagedResponse<PaymentResponse>> GetHistoryAsync(ulong tenantId, ulong? memberId, int page, int size);
    Task<PaymentMethodResponse> SaveMethodAsync(SavePaymentMethodRequest request);
    Task<List<PaymentMethodResponse>> GetMethodsAsync(ulong memberId);
    Task<bool> RemoveMethodAsync(ulong methodId);
    Task<PaymentIntentResponse> CreateIntentAsync(CreatePaymentIntentRequest request);
    Task<bool> SendReminderAsync(PaymentReminderRequest request);
}

public interface IInvoiceService
{
    Task<PagedResponse<InvoiceResponse>> GetAllAsync(InvoiceListRequest request);
    Task<InvoiceResponse> GenerateAsync(GenerateInvoiceRequest request);
    Task<InvoiceResponse?> GetByIdAsync(ulong id);
    Task<byte[]?> GetPdfAsync(ulong id);
    Task<bool> SendAsync(ulong id, SendInvoiceRequest request);
    Task<InvoiceResponse?> MarkPaidAsync(ulong id);
}

public interface IPricingService
{
    Task<List<PricingRuleResponse>> GetRulesAsync(ulong tenantId);
    Task<PricingRuleResponse> CreateRuleAsync(CreatePricingRuleRequest request);
    Task<PricingRuleResponse?> UpdateRuleAsync(ulong id, UpdatePricingRuleRequest request);
    Task<bool> DeleteRuleAsync(ulong id);
    Task<CalculatedPriceResponse> CalculateAsync(CalculatePriceRequest request);
    Task<List<DiscountResponse>> GetDiscountsAsync(ulong tenantId);
    Task<DiscountResponse> CreateDiscountAsync(CreateDiscountRequest request);
    Task<ValidateDiscountResponse> ValidateDiscountAsync(ValidateDiscountRequest request);
}
