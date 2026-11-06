using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.CRM;
using GymManagmentApplication.Domain.Entities.Facility;
using GymManagmentApplication.Domain.Entities.Gamification;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace GymManagmentApplication.Application.Common;

/// <summary>
/// The unit of work Application services depend on (ARCH-022). Implemented by
/// <c>Infrastructure.Data.AppDbContext</c> and registered in DI as the same scoped instance, so
/// services no longer reference the Infrastructure layer. EF Core stays the repository: the sets
/// are plain <see cref="DbSet{TEntity}"/>s, and <see cref="Database"/> / <see cref="ChangeTracker"/>
/// are exposed for transactions (<see cref="UnitOfWork"/>), raw SQL and row locks.
/// Adding a DbSet to AppDbContext: add it here too if a service needs it.
/// </summary>
public interface IAppDbContext
{
    DbSet<Domain.Entities.Core.Tenant> Tenants { get; }
    DbSet<Domain.Entities.Core.Branch> Branches { get; }
    DbSet<TenantSetting> TenantSettings { get; }
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<ModuleAccess> ModuleAccesses { get; }
    DbSet<UserSession> UserSessions { get; }
    DbSet<AuthCode> AuthCodes { get; }
    DbSet<UserTwoFactor> UserTwoFactors { get; }
    DbSet<TwoFactorRecoveryCode> TwoFactorRecoveryCodes { get; }
    DbSet<TwoFactorChallenge> TwoFactorChallenges { get; }
    DbSet<TrustedDevice> TrustedDevices { get; }
    DbSet<SsoProvider> SsoProviders { get; }
    DbSet<Module> Modules { get; }
    DbSet<UserModuleAccess> UserModuleAccesses { get; }
    DbSet<RoleModuleGrant> RoleModuleGrants { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<MembershipPlan> MembershipPlans { get; }
    DbSet<GymMembership> GymMemberships { get; }
    DbSet<CorporateAccount> CorporateAccounts { get; }
    DbSet<Invoice> Invoices { get; }
    DbSet<Payment> Payments { get; }
    DbSet<PaymentGateway> PaymentGateways { get; }
    DbSet<Coupon> Coupons { get; }
    DbSet<CouponRedemption> CouponRedemptions { get; }
    DbSet<MuscleGroup> MuscleGroups { get; }
    DbSet<Equipment> Equipment { get; }
    DbSet<Domain.Entities.Training.Exercise> Exercises { get; }
    DbSet<ExerciseMuscle> ExerciseMuscles { get; }
    DbSet<ExerciseEquipment> ExerciseEquipments { get; }
    DbSet<WorkoutTemplate> WorkoutTemplates { get; }
    DbSet<WorkoutBookmark> WorkoutBookmarks { get; }
    DbSet<WorkoutSection> WorkoutSections { get; }
    DbSet<WorkoutExercise> WorkoutExercises { get; }
    DbSet<WorkoutAssignment> WorkoutAssignments { get; }
    DbSet<WorkoutLog> WorkoutLogs { get; }
    DbSet<Domain.Entities.Training.WorkoutPlan> WorkoutPlans { get; }
    DbSet<WorkoutPlanWeek> WorkoutPlanWeeks { get; }
    DbSet<WorkoutPlanDay> WorkoutPlanDays { get; }
    DbSet<WorkoutPlanAssignment> WorkoutPlanAssignments { get; }
    DbSet<WorkoutPlanBranch> WorkoutPlanBranches { get; }
    DbSet<WorkoutAutomationRule> WorkoutAutomationRules { get; }
    DbSet<WorkoutAutomationLog> WorkoutAutomationLogs { get; }
    DbSet<TrainerProfile> TrainerProfiles { get; }
    DbSet<TrainerClientAssignment> TrainerClientAssignments { get; }
    DbSet<TrainerAvailabilitySlot> TrainerAvailabilitySlots { get; }
    DbSet<TrainerTimeOff> TrainerTimeOffs { get; }
    DbSet<PtSessionType> PtSessionTypes { get; }
    DbSet<PtSession> PtSessions { get; }
    DbSet<ClassType> ClassTypes { get; }
    DbSet<GymClass> GymClasses { get; }
    DbSet<ClassBooking> ClassBookings { get; }
    DbSet<Domain.Entities.Scheduling.Attendance> Attendances { get; }
    DbSet<ClientProfile> ClientProfiles { get; }
    DbSet<HealthMetric> HealthMetrics { get; }
    DbSet<HabitTracker> HabitTrackers { get; }
    DbSet<HabitLog> HabitLogs { get; }
    DbSet<TransformationJournal> TransformationJournals { get; }
    DbSet<Domain.Entities.CRM.Lead> Leads { get; }
    DbSet<LeadActivity> LeadActivities { get; }
    DbSet<Challenge> Challenges { get; }
    DbSet<ChallengeParticipant> ChallengeParticipants { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<CommunicationLog> CommunicationLogs { get; }
    DbSet<PushDevice> PushDevices { get; }
    DbSet<NotificationPreference> NotificationPreferences { get; }
    DbSet<WaitlistOffer> WaitlistOffers { get; }
    // Cancellation & no-show rules (feature 9) — BookingRulesConfigurations.cs
    DbSet<BookingPenalty> BookingPenalties { get; }
    DbSet<BookingBlock> BookingBlocks { get; }
    DbSet<AccessDevice> AccessDevices { get; }
    DbSet<AccessEvent> AccessEvents { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<AssessmentTemplate> AssessmentTemplates { get; }
    DbSet<ClientAssessment> ClientAssessments { get; }
    DbSet<MediaLibrary> MediaLibraries { get; }
    DbSet<OnboardingStep> OnboardingSteps { get; }
    DbSet<PricingRule> PricingRules { get; }
    DbSet<Rating> Ratings { get; }
    DbSet<Domain.Entities.Social.SocialPost> SocialPosts { get; }
    DbSet<Domain.Entities.Social.SocialPostImage> SocialPostImages { get; }
    DbSet<Domain.Entities.Social.SocialPostLike> SocialPostLikes { get; }
    DbSet<Domain.Entities.Social.SocialPostComment> SocialPostComments { get; }
    DbSet<Tag> Tags { get; }
    DbSet<Taggable> Taggables { get; }
    DbSet<ShopCategory> ShopCategories { get; }
    DbSet<ShopProduct> ShopProducts { get; }
    DbSet<ShopProductImage> ShopProductImages { get; }
    DbSet<ShopVariant> ShopVariants { get; }
    DbSet<ShopInventory> ShopInventories { get; }
    DbSet<ShopReview> ShopReviews { get; }
    DbSet<ShopCart> ShopCarts { get; }
    DbSet<ShopCartItem> ShopCartItems { get; }
    DbSet<ShopWishlist> ShopWishlists { get; }
    DbSet<ShopWishlistItem> ShopWishlistItems { get; }
    DbSet<ShopAddress> ShopAddresses { get; }
    DbSet<ShopOrder> ShopOrders { get; }
    DbSet<ShopOrderItem> ShopOrderItems { get; }
    DbSet<ShopPayment> ShopPayments { get; }
    DbSet<TenantCounter> TenantCounters { get; }
    DbSet<Domain.Entities.Safety.WaiverDocument> WaiverDocuments { get; }
    DbSet<Domain.Entities.Safety.WaiverVersion> WaiverVersions { get; }
    DbSet<Domain.Entities.Safety.WaiverSignature> WaiverSignatures { get; }
    DbSet<Domain.Entities.Safety.HealthScreening> HealthScreenings { get; }
    DbSet<Domain.Entities.Safety.MemberEmergencyContact> MemberEmergencyContacts { get; }
    DbSet<Domain.Entities.Safety.ConsentRecord> ConsentRecords { get; }
    DbSet<Domain.Entities.Safety.SafetyGateOverride> SafetyGateOverrides { get; }

    // Gym operations (opening hours, service status, announcements) — OperationsConfigurations.cs
    DbSet<Domain.Entities.Operations.BranchOpeningInterval> BranchOpeningIntervals { get; }
    DbSet<Domain.Entities.Operations.BranchHoursException> BranchHoursExceptions { get; }
    DbSet<Domain.Entities.Operations.BranchProfile> BranchProfiles { get; }
    DbSet<Domain.Entities.Operations.ServiceStatus> ServiceStatuses { get; }
    DbSet<Domain.Entities.Operations.Announcement> Announcements { get; }
    DbSet<Domain.Entities.Operations.AnnouncementRecipient> AnnouncementRecipients { get; }

    // Privacy controls (account deletion, data exports) — PrivacyConfigurations.cs
    DbSet<Domain.Entities.Privacy.AccountDeletionRequest> AccountDeletionRequests { get; }
    DbSet<Domain.Entities.Privacy.DataExportRequest> DataExportRequests { get; }

    // Member self-service: freeze / cancel / change requests — SelfServiceConfigurations.cs
    DbSet<Domain.Entities.Membership.MembershipRequest> MembershipRequests { get; }

    // Facilities: equipment register, problem reports, incident log — FacilitiesConfigurations.cs
    DbSet<Domain.Entities.Facilities.FacilityAsset> FacilityAssets { get; }
    DbSet<Domain.Entities.Facilities.FacilityMaintenance> FacilityMaintenances { get; }
    DbSet<Domain.Entities.Facilities.FacilityReport> FacilityReports { get; }
    DbSet<Domain.Entities.Facilities.FacilityReportFollower> FacilityReportFollowers { get; }
    DbSet<Domain.Entities.Facilities.FacilityReportComment> FacilityReportComments { get; }
    DbSet<Domain.Entities.Facilities.Incident> Incidents { get; }
    DbSet<Domain.Entities.Facilities.IncidentPerson> IncidentPeople { get; }
    DbSet<Domain.Entities.Facilities.IncidentAddendum> IncidentAddenda { get; }

    // Help & feedback: support requests + thread, FAQ, canned replies, class feedback — SupportConfigurations.cs
    DbSet<Domain.Entities.Support.SupportRequest> SupportRequests { get; }
    DbSet<Domain.Entities.Support.SupportMessage> SupportMessages { get; }
    DbSet<Domain.Entities.Support.SupportFaq> SupportFaqs { get; }
    DbSet<Domain.Entities.Support.SupportCannedReply> SupportCannedReplies { get; }
    DbSet<Domain.Entities.Support.ClassFeedback> ClassFeedbacks { get; }

    // Trainer ↔ member messaging: conversations, messages, member opt-out — MessagingConfigurations.cs
    DbSet<Domain.Entities.Messaging.Conversation> Conversations { get; }
    DbSet<Domain.Entities.Messaging.DirectMessage> DirectMessages { get; }
    DbSet<Domain.Entities.Messaging.MessagingUserSetting> MessagingUserSettings { get; }

    DatabaseFacade Database { get; }
    ChangeTracker ChangeTracker { get; }
    IModel Model { get; }

    DbSet<TEntity> Set<TEntity>() where TEntity : class;
    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
