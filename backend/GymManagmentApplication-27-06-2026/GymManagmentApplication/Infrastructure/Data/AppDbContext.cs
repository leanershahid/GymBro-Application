using System.Text.Json;
using GymManagmentApplication.Domain.Entities.AI;
using GymManagmentApplication.Domain.Entities.Analytics;
using GymManagmentApplication.Domain.Entities.Automation;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.CRM;
using GymManagmentApplication.Domain.Entities.Facility;
using GymManagmentApplication.Domain.Entities.Gamification;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Entities.HR;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Entities.Nutrition;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.POS;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Training;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    // Core
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<TenantSetting> TenantSettings => Set<TenantSetting>();

    // Identity
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<ModuleAccess> ModuleAccesses => Set<ModuleAccess>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<SsoProvider> SsoProviders => Set<SsoProvider>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<UserModuleAccess> UserModuleAccesses => Set<UserModuleAccess>();

    // Membership
    public DbSet<MembershipPlan> MembershipPlans => Set<MembershipPlan>();
    public DbSet<GymMembership> GymMemberships => Set<GymMembership>();
    public DbSet<CorporateAccount> CorporateAccounts => Set<CorporateAccount>();

    // Billing
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PaymentGateway> PaymentGateways => Set<PaymentGateway>();
    public DbSet<Coupon> Coupons => Set<Coupon>();
    public DbSet<CouponRedemption> CouponRedemptions => Set<CouponRedemption>();

    // Training
    public DbSet<MuscleGroup> MuscleGroups => Set<MuscleGroup>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<ExerciseMuscle> ExerciseMuscles => Set<ExerciseMuscle>();
    public DbSet<ExerciseEquipment> ExerciseEquipments => Set<ExerciseEquipment>();
    public DbSet<WorkoutTemplate> WorkoutTemplates => Set<WorkoutTemplate>();
    public DbSet<WorkoutSection> WorkoutSections => Set<WorkoutSection>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<WorkoutAssignment> WorkoutAssignments => Set<WorkoutAssignment>();
    public DbSet<WorkoutLog> WorkoutLogs => Set<WorkoutLog>();
    public DbSet<WorkoutLogSet> WorkoutLogSets => Set<WorkoutLogSet>();
    public DbSet<WorkoutProgression> WorkoutProgressions => Set<WorkoutProgression>();
    public DbSet<WorkoutPlan> WorkoutPlans => Set<WorkoutPlan>();
    public DbSet<WorkoutPlanWeek> WorkoutPlanWeeks => Set<WorkoutPlanWeek>();
    public DbSet<WorkoutPlanDay> WorkoutPlanDays => Set<WorkoutPlanDay>();
    public DbSet<WorkoutPlanAssignment> WorkoutPlanAssignments => Set<WorkoutPlanAssignment>();
    public DbSet<WorkoutPlanBranch> WorkoutPlanBranches => Set<WorkoutPlanBranch>();
    public DbSet<WorkoutAutomationRule> WorkoutAutomationRules => Set<WorkoutAutomationRule>();
    public DbSet<WorkoutAutomationLog> WorkoutAutomationLogs => Set<WorkoutAutomationLog>();
    public DbSet<TrainerProfile> TrainerProfiles => Set<TrainerProfile>();
    public DbSet<TrainerClientAssignment> TrainerClientAssignments => Set<TrainerClientAssignment>();
    public DbSet<TrainerAvailabilitySlot> TrainerAvailabilitySlots => Set<TrainerAvailabilitySlot>();
    public DbSet<TrainerTimeOff> TrainerTimeOffs => Set<TrainerTimeOff>();
    public DbSet<PtSessionType> PtSessionTypes => Set<PtSessionType>();
    public DbSet<PtSession> PtSessions => Set<PtSession>();

    // Scheduling
    public DbSet<ClassType> ClassTypes => Set<ClassType>();
    public DbSet<GymClass> GymClasses => Set<GymClass>();
    public DbSet<ClassBooking> ClassBookings => Set<ClassBooking>();
    public DbSet<Attendance> Attendances => Set<Attendance>();

    // Health
    public DbSet<ClientProfile> ClientProfiles => Set<ClientProfile>();
    public DbSet<ClientGoal> ClientGoals => Set<ClientGoal>();
    public DbSet<HealthMetric> HealthMetrics => Set<HealthMetric>();
    public DbSet<InjuryRecord> InjuryRecords => Set<InjuryRecord>();
    public DbSet<HabitTracker> HabitTrackers => Set<HabitTracker>();
    public DbSet<HabitLog> HabitLogs => Set<HabitLog>();
    public DbSet<TransformationJournal> TransformationJournals => Set<TransformationJournal>();
    public DbSet<WearableDevice> WearableDevices => Set<WearableDevice>();

    // Nutrition
    public DbSet<FoodItem> FoodItems => Set<FoodItem>();
    public DbSet<DietPlan> DietPlans => Set<DietPlan>();
    public DbSet<NutritionLog> NutritionLogs => Set<NutritionLog>();

    // CRM
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadActivity> LeadActivities => Set<LeadActivity>();
    public DbSet<Referral> Referrals => Set<Referral>();
    public DbSet<ReferralProgram> ReferralPrograms => Set<ReferralProgram>();

    // Gamification
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<ChallengeParticipant> ChallengeParticipants => Set<ChallengeParticipant>();

    // Communication
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationTemplate> NotificationTemplates => Set<NotificationTemplate>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CommunicationLog> CommunicationLogs => Set<CommunicationLog>();
    public DbSet<FeedbackSurvey> FeedbackSurveys => Set<FeedbackSurvey>();
    public DbSet<FeedbackResponse> FeedbackResponses => Set<FeedbackResponse>();
    public DbSet<Webhook> Webhooks => Set<Webhook>();
    public DbSet<WebhookDelivery> WebhookDeliveries => Set<WebhookDelivery>();

    // Automation
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();
    public DbSet<AutomationLog> AutomationLogs => Set<AutomationLog>();
    public DbSet<ScheduledTask> ScheduledTasks => Set<ScheduledTask>();

    // Facility
    public DbSet<FacilityEquipment> FacilityEquipments => Set<FacilityEquipment>();
    public DbSet<EquipmentMaintenanceLog> EquipmentMaintenanceLogs => Set<EquipmentMaintenanceLog>();
    public DbSet<EquipmentBooking> EquipmentBookings => Set<EquipmentBooking>();
    public DbSet<Locker> Lockers => Set<Locker>();
    public DbSet<LockerAssignment> LockerAssignments => Set<LockerAssignment>();
    public DbSet<AccessDevice> AccessDevices => Set<AccessDevice>();
    public DbSet<AccessEvent> AccessEvents => Set<AccessEvent>();

    // HR
    public DbSet<PayrollConfig> PayrollConfigs => Set<PayrollConfig>();
    public DbSet<PayrollPeriod> PayrollPeriods => Set<PayrollPeriod>();
    public DbSet<PayrollSlip> PayrollSlips => Set<PayrollSlip>();

    // Analytics
    public DbSet<AnalyticsDaily> AnalyticsDailys => Set<AnalyticsDaily>();
    public DbSet<TrainerAnalyticsDaily> TrainerAnalyticsDailys => Set<TrainerAnalyticsDaily>();

    // AI
    public DbSet<AiChatSession> AiChatSessions => Set<AiChatSession>();
    public DbSet<AiChatMessage> AiChatMessages => Set<AiChatMessage>();
    public DbSet<MlPrediction> MlPredictions => Set<MlPrediction>();
    public DbSet<PoseLog> PoseLogs => Set<PoseLog>();

    // Platform
    public DbSet<ApiKey> ApiKeys => Set<ApiKey>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AssessmentTemplate> AssessmentTemplates => Set<AssessmentTemplate>();
    public DbSet<ClientAssessment> ClientAssessments => Set<ClientAssessment>();
    public DbSet<CustomFieldDefinition> CustomFieldDefinitions => Set<CustomFieldDefinition>();
    public DbSet<CustomPage> CustomPages => Set<CustomPage>();
    public DbSet<ExportJob> ExportJobs => Set<ExportJob>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<MediaLibrary> MediaLibraries => Set<MediaLibrary>();
    public DbSet<NavigationMenu> NavigationMenus => Set<NavigationMenu>();
    public DbSet<OnboardingStep> OnboardingSteps => Set<OnboardingStep>();
    public DbSet<Plugin> Plugins => Set<Plugin>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<SearchIndexCache> SearchIndexCaches => Set<SearchIndexCache>();
    public DbSet<SocialPost> SocialPosts => Set<SocialPost>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketReply> SupportTicketReplies => Set<SupportTicketReply>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Taggable> Taggables => Set<Taggable>();
    public DbSet<TenantFeatureOverride> TenantFeatureOverrides => Set<TenantFeatureOverride>();
    public DbSet<TenantPlugin> TenantPlugins => Set<TenantPlugin>();
    public DbSet<UiTheme> UiThemes => Set<UiTheme>();
    public DbSet<VirtualSession> VirtualSessions => Set<VirtualSession>();

    // POS
    public DbSet<PosProduct> PosProducts => Set<PosProduct>();
    public DbSet<PosOrder> PosOrders => Set<PosOrder>();
    public DbSet<PosOrderItem> PosOrderItems => Set<PosOrderItem>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<JsonDocument>()
            .HaveConversion<JsonDocumentConverter>()
            .HaveColumnType("jsonb");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Auto-increment for ulong PKs — Id is generated in application code (MAX+1)
        // because the DB uses numeric(20,0) with no native identity/sequence strategy.
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var pk = entity.FindProperty("Id");
            if (pk != null && pk.ClrType == typeof(ulong))
                pk.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
        }

        // Composite keys
        modelBuilder.Entity<ExerciseMuscle>().HasKey(e => new { e.ExerciseId, e.MuscleId });
        modelBuilder.Entity<ExerciseEquipment>().HasKey(e => new { e.ExerciseId, e.EquipmentId });
        modelBuilder.Entity<RolePermission>().HasKey(e => new { e.RoleId, e.PermissionId });

        // ModuleAccess — unique constraint per tenant + role + module
        modelBuilder.Entity<ModuleAccess>()
            .HasIndex(m => new { m.TenantId, m.RoleId, m.Module })
            .IsUnique();

        modelBuilder.Entity<ModuleAccess>()
            .HasOne(m => m.Tenant)
            .WithMany()
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ModuleAccess>()
            .HasOne(m => m.Role)
            .WithMany()
            .HasForeignKey(m => m.RoleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Indexes
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<User>().HasIndex(u => u.Uuid).IsUnique();
        modelBuilder.Entity<Tenant>().HasIndex(t => t.Slug).IsUnique();
        modelBuilder.Entity<Exercise>().HasIndex(e => e.Slug).IsUnique();

        // Prevent cascade delete cycles
        modelBuilder.Entity<WorkoutProgression>()
            .HasOne(wp => wp.NextWorkoutTemplate)
            .WithMany()
            .HasForeignKey(wp => wp.NextTemplate)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkoutPlanBranch>()
            .HasOne(b => b.NextPlan)
            .WithMany()
            .HasForeignKey(b => b.NextPlanId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkoutAssignment>()
            .HasOne(wa => wa.Tenant)
            .WithMany()
            .HasForeignKey(wa => wa.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkoutAssignment>()
            .HasOne(wa => wa.Client)
            .WithMany()
            .HasForeignKey(wa => wa.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkoutPlanAssignment>()
            .HasOne(a => a.Client)
            .WithMany()
            .HasForeignKey(a => a.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<WorkoutLog>()
            .HasOne(l => l.Client)
            .WithMany()
            .HasForeignKey(l => l.ClientId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<User>()
            .HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SupportTicket>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SupportTicket>()
            .HasOne(s => s.AssignedUser)
            .WithMany()
            .HasForeignKey(s => s.AssignedTo)
            .OnDelete(DeleteBehavior.Restrict);

        // Fix cascade paths - entities with Tenant nav prop
        modelBuilder.Entity<FacilityEquipment>().HasOne(f => f.Tenant).WithMany().HasForeignKey(f => f.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<GymClass>().HasOne(g => g.Tenant).WithMany().HasForeignKey(g => g.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Attendance>().HasOne(a => a.Tenant).WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PtSession>().HasOne(p => p.Tenant).WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PtSession>().HasOne(p => p.Client).WithMany().HasForeignKey(p => p.ClientId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<GymMembership>().HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Invoice>().HasOne(i => i.Tenant).WithMany().HasForeignKey(i => i.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payment>().HasOne(p => p.Tenant).WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Lead>().HasOne(l => l.Tenant).WithMany().HasForeignKey(l => l.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Notification>().HasOne(n => n.Tenant).WithMany().HasForeignKey(n => n.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PayrollConfig>().HasOne(p => p.Tenant).WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<DietPlan>().HasOne(d => d.Tenant).WithMany().HasForeignKey(d => d.TenantId).OnDelete(DeleteBehavior.Restrict);
        //modelBuilder.Entity<TrainerProfile>().HasOne(t => t.Tenant).WithMany().HasForeignKey(t => t.TenantId).OnDelete(DeleteBehavior.Restrict);
        //modelBuilder.Entity<TrainerClientAssignment>().HasOne(t => t.Tenant).WithMany().HasForeignKey(t => t.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<WorkoutTemplate>().HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<WorkoutPlan>().HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<WorkoutAutomationRule>().HasOne(w => w.Tenant).WithMany().HasForeignKey(w => w.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AiChatSession>().HasOne(a => a.Tenant).WithMany().HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<VirtualSession>().HasOne(v => v.Tenant).WithMany().HasForeignKey(v => v.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Rating>().HasOne(r => r.Tenant).WithMany().HasForeignKey(r => r.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SocialPost>().HasOne(s => s.Tenant).WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<MediaLibrary>().HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);

        // Fix cascade on PosOrderItems
        modelBuilder.Entity<PosOrderItem>()
            .HasOne(p => p.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PosOrderItem>()
            .HasOne(p => p.Product)
            .WithMany()
            .HasForeignKey(p => p.ProductId)
            .OnDelete(DeleteBehavior.Restrict);

        // Decimal precision
        modelBuilder.Entity<MlPrediction>().Property(e => e.Confidence).HasPrecision(18, 6);
        modelBuilder.Entity<MlPrediction>().Property(e => e.Score).HasPrecision(18, 6);
        modelBuilder.Entity<PoseLog>().Property(e => e.Score).HasPrecision(18, 6);
        modelBuilder.Entity<AnalyticsDaily>().Property(e => e.Revenue).HasPrecision(18, 2);
        modelBuilder.Entity<TrainerAnalyticsDaily>().Property(e => e.AvgRating).HasPrecision(10, 4);
        modelBuilder.Entity<TrainerAnalyticsDaily>().Property(e => e.RevenueGenerated).HasPrecision(18, 2);
        modelBuilder.Entity<Coupon>().Property(e => e.Value).HasPrecision(18, 2);
        modelBuilder.Entity<Coupon>().Property(e => e.MinOrder).HasPrecision(18, 2);
        modelBuilder.Entity<Coupon>().Property(e => e.MaxDiscount).HasPrecision(18, 2);
        modelBuilder.Entity<CouponRedemption>().Property(e => e.DiscountApplied).HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>().Property(e => e.Subtotal).HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>().Property(e => e.Tax).HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>().Property(e => e.Discount).HasPrecision(18, 2);
        modelBuilder.Entity<Invoice>().Property(e => e.Total).HasPrecision(18, 2);
        modelBuilder.Entity<Payment>().Property(e => e.Amount).HasPrecision(18, 2);
        modelBuilder.Entity<Lead>().Property(e => e.ConversionProb).HasPrecision(10, 4);
        modelBuilder.Entity<CommunicationLog>().Property(e => e.Cost).HasPrecision(18, 6);
        modelBuilder.Entity<Branch>().Property(e => e.Lat).HasPrecision(10, 7);
        modelBuilder.Entity<Branch>().Property(e => e.Lng).HasPrecision(10, 7);
        modelBuilder.Entity<AccessEvent>().Property(e => e.Confidence).HasPrecision(10, 4);
        modelBuilder.Entity<EquipmentMaintenanceLog>().Property(e => e.Cost).HasPrecision(18, 2);
        modelBuilder.Entity<Challenge>().Property(e => e.TargetValue).HasPrecision(18, 4);
        modelBuilder.Entity<ChallengeParticipant>().Property(e => e.Progress).HasPrecision(18, 4);
        modelBuilder.Entity<PayrollConfig>().Property(e => e.BaseSalary).HasPrecision(18, 2);
        modelBuilder.Entity<PayrollSlip>().Property(e => e.BaseSalary).HasPrecision(18, 2);
        modelBuilder.Entity<PayrollSlip>().Property(e => e.Bonuses).HasPrecision(18, 2);
        modelBuilder.Entity<PayrollSlip>().Property(e => e.Commission).HasPrecision(18, 2);
        modelBuilder.Entity<PayrollSlip>().Property(e => e.Deductions).HasPrecision(18, 2);
        modelBuilder.Entity<PayrollSlip>().Property(e => e.NetPay).HasPrecision(18, 2);
        modelBuilder.Entity<ClientGoal>().Property(e => e.TargetValue).HasPrecision(18, 4);
        modelBuilder.Entity<ClientGoal>().Property(e => e.CurrentValue).HasPrecision(18, 4);
        modelBuilder.Entity<ClientProfile>().Property(e => e.WeightKg).HasPrecision(10, 3);
        modelBuilder.Entity<ClientProfile>().Property(e => e.HeightCm).HasPrecision(10, 3);
        modelBuilder.Entity<ClientProfile>().Property(e => e.BodyFatPct).HasPrecision(10, 3);
        modelBuilder.Entity<ClientProfile>().Property(e => e.MuscleMassKg).HasPrecision(10, 3);
        modelBuilder.Entity<HealthMetric>().Property(e => e.WeightKg).HasPrecision(10, 3);
        modelBuilder.Entity<HealthMetric>().Property(e => e.BodyFatPct).HasPrecision(10, 3);
        modelBuilder.Entity<HealthMetric>().Property(e => e.Bmi).HasPrecision(10, 4);
        modelBuilder.Entity<HealthMetric>().Property(e => e.SleepHours).HasPrecision(10, 2);
        modelBuilder.Entity<MembershipPlan>().Property(e => e.Price).HasPrecision(18, 2);
        modelBuilder.Entity<FoodItem>().Property(e => e.ServingG).HasPrecision(10, 3);
        modelBuilder.Entity<FoodItem>().Property(e => e.ProteinG).HasPrecision(10, 3);
        modelBuilder.Entity<FoodItem>().Property(e => e.CarbsG).HasPrecision(10, 3);
        modelBuilder.Entity<FoodItem>().Property(e => e.FatG).HasPrecision(10, 3);
        modelBuilder.Entity<FoodItem>().Property(e => e.FiberG).HasPrecision(10, 3);
        modelBuilder.Entity<NutritionLog>().Property(e => e.QuantityG).HasPrecision(10, 3);
        modelBuilder.Entity<PosOrder>().Property(e => e.Subtotal).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrder>().Property(e => e.Tax).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrder>().Property(e => e.Discount).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrder>().Property(e => e.Total).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrderItem>().Property(e => e.UnitPrice).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrderItem>().Property(e => e.TaxAmount).HasPrecision(18, 2);
        modelBuilder.Entity<PosOrderItem>().Property(e => e.LineTotal).HasPrecision(18, 2);
        modelBuilder.Entity<PosProduct>().Property(e => e.Price).HasPrecision(18, 2);
        modelBuilder.Entity<PosProduct>().Property(e => e.Cost).HasPrecision(18, 2);
        modelBuilder.Entity<PosProduct>().Property(e => e.TaxRate).HasPrecision(10, 4);
        modelBuilder.Entity<ClientAssessment>().Property(e => e.Score).HasPrecision(10, 4);
        modelBuilder.Entity<PricingRule>().Property(e => e.PriceModifier).HasPrecision(18, 4);
        modelBuilder.Entity<PtSession>().Property(e => e.Price).HasPrecision(18, 2);
        modelBuilder.Entity<PtSessionType>().Property(e => e.Price).HasPrecision(18, 2);
        modelBuilder.Entity<TrainerProfile>().Property(e => e.Rating).HasPrecision(10, 4);
        modelBuilder.Entity<WorkoutLog>().Property(e => e.Score).HasPrecision(10, 4);
        modelBuilder.Entity<WorkoutLogSet>().Property(e => e.WeightKg).HasPrecision(10, 3);
        modelBuilder.Entity<WorkoutLogSet>().Property(e => e.DistanceM).HasPrecision(10, 3);

        // Fix cascade paths - entities without Tenant nav prop (use shadow FK)
        var noNavTenantEntities = new[]
        {
            typeof(EquipmentBooking), typeof(Locker), typeof(LockerAssignment),
            typeof(CouponRedemption), typeof(LeadActivity), typeof(Referral),
            typeof(UserAchievement), typeof(ChallengeParticipant), typeof(FeedbackResponse),
            typeof(WebhookDelivery), typeof(PayrollSlip), typeof(ClientProfile),
            typeof(ClientGoal), typeof(HealthMetric), typeof(InjuryRecord),
            typeof(HabitTracker), typeof(HabitLog), typeof(TransformationJournal),
            typeof(WearableDevice), typeof(NutritionLog), typeof(PoseLog),
            typeof(ClientAssessment)
        };
        foreach (var entityType in noNavTenantEntities)
        {
            modelBuilder.Entity(entityType)
                .HasOne(typeof(Tenant), null)
                .WithMany()
                .HasForeignKey("TenantId")
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}

public class JsonDocumentConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<JsonDocument, string>
{
    public JsonDocumentConverter() : base(
        v => v.RootElement.GetRawText(),
        v => Parse(v)) { }

    private static JsonDocument Parse(string v) => JsonDocument.Parse(v);
}
