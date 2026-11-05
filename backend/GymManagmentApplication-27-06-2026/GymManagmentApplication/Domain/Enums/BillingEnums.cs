namespace GymManagmentApplication.Domain.Enums;

// Memberships, invoices, payments, coupons and pricing.

public enum BillingCycle { Daily, Weekly, Monthly, Quarterly, HalfYearly, Yearly, OneTime }
public enum MembershipStatus { Active, Expired, Cancelled, Paused, Trial, Pending }
public enum MembershipSource { Online, Pos, Import, Admin, Referral }
public enum CorporateStatus { Active, Inactive }
public enum InvoiceStatus { Draft, Sent, Paid, Overdue, Void, Refunded }
public enum PaymentMethod { Card, Upi, Netbanking, Cash, Cheque, Wallet, Crypto }
public enum PaymentStatus { Pending, Completed, Failed, Refunded }
public enum CouponType { Percentage, Fixed, FreeTrial, Gift }
public enum PricingAppliesTo { MembershipPlan, PtSession, Class, Product }
public enum PricingRuleType { TimeBased, UsageBased, SegmentBased, Promotional }
public enum PriceModifierType { Percentage, Fixed }
