using System.Text.Json;
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
using System.Linq.Expressions;
using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Data;

public class AppDbContext : DbContext, IAppDbContext
{
    private readonly ICurrentUser? currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser? currentUser = null) : base(options)
    {
        this.currentUser = currentUser;
        // ARCH-004: on Postgres ids come from per-table sequences (see UseIdSequences); the
        // in-memory MAX(Id)+1 assignment is kept only for other providers (the SQLite test db).
        if (!Database.IsNpgsql()) ChangeTracker.Tracking += AssignIdOnTracking;
    }

    // ── Tenant isolation ────────────────────────────────────────────────────
    // Every entity with a CLR TenantId gets a global query filter (see ApplyTenantFilters).
    // Evaluated per DbContext instance, i.e. per request:
    //   * anonymous / background (no HttpContext) → no filter (login, seeding)
    //   * super admin                              → no filter (platform-wide)
    //   * anyone else                              → own tenant only; a token without a
    //                                                 tenant claim sees nothing (fails closed)
    public bool TenantFilterDisabled => currentUser is null || !currentUser.IsAuthenticated || currentUser.IsSuperAdmin;
    public ulong CurrentTenantId => currentUser?.TenantId ?? 0;

    // ── Branch isolation ────────────────────────────────────────────────────
    // Staff and custom-role users who are assigned to a branch only see that branch's
    // branch-owned records (members, memberships, attendance, leads). Gym admins, super admins,
    // trainers/clients (scoped elsewhere) and unassigned staff are not branch-filtered.
    // Rows without a branch (gym-wide) stay visible.
    private static readonly HashSet<Type> BranchScopedTypes =
    [
        typeof(Domain.Entities.Identity.User),
        typeof(Domain.Entities.Membership.GymMembership),
        typeof(Domain.Entities.Scheduling.Attendance),
        typeof(Domain.Entities.CRM.Lead),
    ];
    // Nullable TenantId means "shared library row" only for these types (see ApplyTenantFilters).
    private static readonly HashSet<Type> SharedLibraryTypes =
    [
        typeof(Domain.Entities.Training.Exercise),
        typeof(Domain.Entities.Training.Equipment),
    ];

    // Soft-deleted rows these tables hide through the global filter. Only leaf tables: nothing
    // navigates to them as a required principal, so filtering cannot drop dependent rows from
    // Include()/joins, and every existing query already skipped deleted rows. User and the shop
    // catalog (category/product/variant) keep explicit `DeletedAt == null` checks because orders,
    // invoices and carts must still load their deleted user/variant. Use .NotDeleted() for those.
    private static readonly HashSet<Type> SoftDeleteFilteredTypes =
    [
        typeof(Domain.Entities.Shop.ShopReview),
        typeof(Domain.Entities.Shop.ShopAddress),
    ];

    public bool BranchFilterDisabled => currentUser is null || !currentUser.IsAuthenticated
        || !currentUser.IsDelegatedRole || currentUser.BranchId is null;
    public ulong CurrentBranchId => currentUser?.BranchId ?? 0;

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
    public DbSet<AuthCode> AuthCodes => Set<AuthCode>();
    // Two-step sign-in (feature 10) — AuthSecurityConfigurations.cs
    public DbSet<UserTwoFactor> UserTwoFactors => Set<UserTwoFactor>();
    public DbSet<TwoFactorRecoveryCode> TwoFactorRecoveryCodes => Set<TwoFactorRecoveryCode>();
    public DbSet<TwoFactorChallenge> TwoFactorChallenges => Set<TwoFactorChallenge>();
    public DbSet<TrustedDevice> TrustedDevices => Set<TrustedDevice>();
    public DbSet<SsoProvider> SsoProviders => Set<SsoProvider>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<UserModuleAccess> UserModuleAccesses => Set<UserModuleAccess>();
    public DbSet<RoleModuleGrant> RoleModuleGrants => Set<RoleModuleGrant>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();

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
    public DbSet<WorkoutBookmark> WorkoutBookmarks => Set<WorkoutBookmark>();
    public DbSet<WorkoutSection> WorkoutSections => Set<WorkoutSection>();
    public DbSet<WorkoutExercise> WorkoutExercises => Set<WorkoutExercise>();
    public DbSet<WorkoutAssignment> WorkoutAssignments => Set<WorkoutAssignment>();
    public DbSet<WorkoutLog> WorkoutLogs => Set<WorkoutLog>();
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
    public DbSet<HealthMetric> HealthMetrics => Set<HealthMetric>();
    public DbSet<HabitTracker> HabitTrackers => Set<HabitTracker>();
    public DbSet<HabitLog> HabitLogs => Set<HabitLog>();
    public DbSet<TransformationJournal> TransformationJournals => Set<TransformationJournal>();

    // CRM
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<LeadActivity> LeadActivities => Set<LeadActivity>();

    // Gamification
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<ChallengeParticipant> ChallengeParticipants => Set<ChallengeParticipant>();

    // Communication
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<CommunicationLog> CommunicationLogs => Set<CommunicationLog>();
    // Push notifications & preferences, class waitlist offers — NotificationConfigurations.cs
    public DbSet<PushDevice> PushDevices => Set<PushDevice>();
    public DbSet<NotificationPreference> NotificationPreferences => Set<NotificationPreference>();
    public DbSet<WaitlistOffer> WaitlistOffers => Set<WaitlistOffer>();
    // Cancellation & no-show rules (feature 9) — BookingRulesConfigurations.cs
    public DbSet<BookingPenalty> BookingPenalties => Set<BookingPenalty>();
    public DbSet<BookingBlock> BookingBlocks => Set<BookingBlock>();

    // Facility
    public DbSet<AccessDevice> AccessDevices => Set<AccessDevice>();
    public DbSet<AccessEvent> AccessEvents => Set<AccessEvent>();

    // Platform
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<AssessmentTemplate> AssessmentTemplates => Set<AssessmentTemplate>();
    public DbSet<ClientAssessment> ClientAssessments => Set<ClientAssessment>();
    public DbSet<MediaLibrary> MediaLibraries => Set<MediaLibrary>();
    public DbSet<OnboardingStep> OnboardingSteps => Set<OnboardingStep>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<Rating> Ratings => Set<Rating>();
    // Social feed
    public DbSet<Domain.Entities.Social.SocialPost> SocialPosts => Set<Domain.Entities.Social.SocialPost>();
    public DbSet<Domain.Entities.Social.SocialPostImage> SocialPostImages => Set<Domain.Entities.Social.SocialPostImage>();
    public DbSet<Domain.Entities.Social.SocialPostLike> SocialPostLikes => Set<Domain.Entities.Social.SocialPostLike>();
    public DbSet<Domain.Entities.Social.SocialPostComment> SocialPostComments => Set<Domain.Entities.Social.SocialPostComment>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<Taggable> Taggables => Set<Taggable>();

    // Shop (replaces the old POS tables)
    public DbSet<ShopCategory> ShopCategories => Set<ShopCategory>();
    public DbSet<ShopProduct> ShopProducts => Set<ShopProduct>();
    public DbSet<ShopProductImage> ShopProductImages => Set<ShopProductImage>();
    public DbSet<ShopVariant> ShopVariants => Set<ShopVariant>();
    public DbSet<ShopInventory> ShopInventories => Set<ShopInventory>();
    public DbSet<ShopReview> ShopReviews => Set<ShopReview>();
    public DbSet<ShopCart> ShopCarts => Set<ShopCart>();
    public DbSet<ShopCartItem> ShopCartItems => Set<ShopCartItem>();
    public DbSet<ShopWishlist> ShopWishlists => Set<ShopWishlist>();
    public DbSet<ShopWishlistItem> ShopWishlistItems => Set<ShopWishlistItem>();
    public DbSet<ShopAddress> ShopAddresses => Set<ShopAddress>();
    public DbSet<ShopOrder> ShopOrders => Set<ShopOrder>();
    public DbSet<ShopOrderItem> ShopOrderItems => Set<ShopOrderItem>();
    public DbSet<ShopPayment> ShopPayments => Set<ShopPayment>();
    public DbSet<TenantCounter> TenantCounters => Set<TenantCounter>();

    // Safety & compliance (waivers, health screening, emergency contacts, consents) — SafetyConfigurations.cs
    public DbSet<Domain.Entities.Safety.WaiverDocument> WaiverDocuments => Set<Domain.Entities.Safety.WaiverDocument>();
    public DbSet<Domain.Entities.Safety.WaiverVersion> WaiverVersions => Set<Domain.Entities.Safety.WaiverVersion>();
    public DbSet<Domain.Entities.Safety.WaiverSignature> WaiverSignatures => Set<Domain.Entities.Safety.WaiverSignature>();
    public DbSet<Domain.Entities.Safety.HealthScreening> HealthScreenings => Set<Domain.Entities.Safety.HealthScreening>();
    public DbSet<Domain.Entities.Safety.MemberEmergencyContact> MemberEmergencyContacts => Set<Domain.Entities.Safety.MemberEmergencyContact>();
    public DbSet<Domain.Entities.Safety.ConsentRecord> ConsentRecords => Set<Domain.Entities.Safety.ConsentRecord>();
    public DbSet<Domain.Entities.Safety.SafetyGateOverride> SafetyGateOverrides => Set<Domain.Entities.Safety.SafetyGateOverride>();

    // Gym operations: opening hours, service status, announcements — OperationsConfigurations.cs
    public DbSet<Domain.Entities.Operations.BranchOpeningInterval> BranchOpeningIntervals => Set<Domain.Entities.Operations.BranchOpeningInterval>();
    public DbSet<Domain.Entities.Operations.BranchHoursException> BranchHoursExceptions => Set<Domain.Entities.Operations.BranchHoursException>();
    public DbSet<Domain.Entities.Operations.BranchProfile> BranchProfiles => Set<Domain.Entities.Operations.BranchProfile>();
    public DbSet<Domain.Entities.Operations.ServiceStatus> ServiceStatuses => Set<Domain.Entities.Operations.ServiceStatus>();
    public DbSet<Domain.Entities.Operations.Announcement> Announcements => Set<Domain.Entities.Operations.Announcement>();
    public DbSet<Domain.Entities.Operations.AnnouncementRecipient> AnnouncementRecipients => Set<Domain.Entities.Operations.AnnouncementRecipient>();

    // Privacy controls: account deletion requests, data exports — PrivacyConfigurations.cs
    public DbSet<Domain.Entities.Privacy.AccountDeletionRequest> AccountDeletionRequests => Set<Domain.Entities.Privacy.AccountDeletionRequest>();
    public DbSet<Domain.Entities.Privacy.DataExportRequest> DataExportRequests => Set<Domain.Entities.Privacy.DataExportRequest>();

    // Member self-service: freeze / cancel / change requests — SelfServiceConfigurations.cs
    public DbSet<Domain.Entities.Membership.MembershipRequest> MembershipRequests => Set<Domain.Entities.Membership.MembershipRequest>();

    // Facilities: equipment register, problem reports, incident log — FacilitiesConfigurations.cs
    public DbSet<Domain.Entities.Facilities.FacilityAsset> FacilityAssets => Set<Domain.Entities.Facilities.FacilityAsset>();
    public DbSet<Domain.Entities.Facilities.FacilityMaintenance> FacilityMaintenances => Set<Domain.Entities.Facilities.FacilityMaintenance>();
    public DbSet<Domain.Entities.Facilities.FacilityReport> FacilityReports => Set<Domain.Entities.Facilities.FacilityReport>();
    public DbSet<Domain.Entities.Facilities.FacilityReportFollower> FacilityReportFollowers => Set<Domain.Entities.Facilities.FacilityReportFollower>();
    public DbSet<Domain.Entities.Facilities.FacilityReportComment> FacilityReportComments => Set<Domain.Entities.Facilities.FacilityReportComment>();
    public DbSet<Domain.Entities.Facilities.Incident> Incidents => Set<Domain.Entities.Facilities.Incident>();
    public DbSet<Domain.Entities.Facilities.IncidentPerson> IncidentPeople => Set<Domain.Entities.Facilities.IncidentPerson>();
    public DbSet<Domain.Entities.Facilities.IncidentAddendum> IncidentAddenda => Set<Domain.Entities.Facilities.IncidentAddendum>();

    // Help & feedback: support requests + thread, FAQ, canned replies, class feedback — SupportConfigurations.cs
    public DbSet<Domain.Entities.Support.SupportRequest> SupportRequests => Set<Domain.Entities.Support.SupportRequest>();
    public DbSet<Domain.Entities.Support.SupportMessage> SupportMessages => Set<Domain.Entities.Support.SupportMessage>();
    public DbSet<Domain.Entities.Support.SupportFaq> SupportFaqs => Set<Domain.Entities.Support.SupportFaq>();
    public DbSet<Domain.Entities.Support.SupportCannedReply> SupportCannedReplies => Set<Domain.Entities.Support.SupportCannedReply>();
    public DbSet<Domain.Entities.Support.ClassFeedback> ClassFeedbacks => Set<Domain.Entities.Support.ClassFeedback>();

    // Trainer ↔ member messaging: conversations, messages, member opt-out — MessagingConfigurations.cs
    public DbSet<Domain.Entities.Messaging.Conversation> Conversations => Set<Domain.Entities.Messaging.Conversation>();
    public DbSet<Domain.Entities.Messaging.DirectMessage> DirectMessages => Set<Domain.Entities.Messaging.DirectMessage>();
    public DbSet<Domain.Entities.Messaging.MessagingUserSetting> MessagingUserSettings => Set<Domain.Entities.Messaging.MessagingUserSetting>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // ARCH-085: compared by raw JSON so re-assigning an equal document is not an UPDATE.
        configurationBuilder.Properties<JsonDocument>()
            .HaveConversion<JsonDocumentConverter, JsonDocumentComparer>()
            .HaveColumnType("jsonb");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ulong PKs are numeric(20,0), which has no identity. Default: no store generation; the
        // Npgsql model overrides this below with per-table sequences (UseIdSequences).
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            var pk = entity.FindProperty("Id");
            if (pk != null && pk.ClrType == typeof(ulong))
                pk.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
        }

        ApplyTenantFilters(modelBuilder);

        // Per-entity mapping lives in Infrastructure/Data/Configurations (ARCH-038): one
        // IEntityTypeConfiguration<T> per entity, grouped by area.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        if (Database.IsNpgsql()) UseIdSequences(modelBuilder);
    }

    /// <summary>Name of the sequence behind a table's ulong Id (created by migration IdSequences).</summary>
    public static string IdSequenceName(string table) => $"{table}_Id_hilo_seq";

    /// <summary>
    /// ARCH-004/040: every single-column ulong "Id" key draws from its own Postgres sequence
    /// (INCREMENT BY <see cref="IdSequenceValueGenerator.BlockSize"/>) through
    /// <see cref="IdSequenceValueGenerator"/>, a HiLo generator: one nextval() reserves a block of
    /// ids that is handed out in memory. Ids are race-free across requests and app instances and,
    /// as with the old MAX(Id)+1 scheme, known as soon as an entity is added (before SaveChanges).
    /// Explicit ids are still honoured. Composite keys (TenantCounters, RolePermissions, ...) and
    /// owned types are untouched.
    /// </summary>
    private static void UseIdSequences(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
        {
            if (entity.IsOwned() || entity.BaseType is not null) continue;
            var key = entity.FindPrimaryKey();
            if (key is not { Properties.Count: 1 } || key.Properties[0].Name != "Id" || key.Properties[0].ClrType != typeof(ulong))
                continue;
            var table = entity.GetTableName();
            if (table is null) continue;
            var sequence = IdSequenceName(table);
            modelBuilder.HasSequence<long>(sequence).IncrementsBy(IdSequenceValueGenerator.BlockSize);
            modelBuilder.Entity(entity.ClrType).Property("Id")
                .ValueGeneratedOnAdd()
                .HasValueGenerator((_, _) => new IdSequenceValueGenerator(sequence));
        }
    }

    private void ApplyTenantFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // Only real CLR TenantId properties — shadow FK columns are never populated.
            var clrProperty = entityType.ClrType.GetProperty("TenantId");
            if (clrProperty is null || entityType.BaseType is not null) continue;

            var param = Expression.Parameter(entityType.ClrType, "e");
            var ctx = Expression.Constant(this);
            var disabled = Expression.Property(ctx, nameof(TenantFilterDisabled));
            var current = Expression.Property(ctx, nameof(CurrentTenantId));
            var tenantProp = Expression.Property(param, clrProperty);

            Expression match;
            if (clrProperty.PropertyType == typeof(ulong))
            {
                match = Expression.Equal(tenantProp, current);
            }
            else if (clrProperty.PropertyType == typeof(ulong?))
            {
                var ownTenant = Expression.Equal(tenantProp, Expression.Convert(current, typeof(ulong?)));
                // Null tenant = shared/global row (built-in exercise / equipment library), visible to all.
                // For every other nullable-TenantId entity (per-member data, audit log) a row without a
                // tenant is visible to nobody but platform/background contexts (ARCH-036).
                match = SharedLibraryTypes.Contains(entityType.ClrType)
                    ? Expression.OrElse(Expression.Equal(tenantProp, Expression.Constant(null, typeof(ulong?))), ownTenant)
                    : ownTenant;
            }
            else continue;

            Expression body = Expression.OrElse(disabled, match);

            // Soft delete (ARCH-037): AND-ed into the same lambda, and applied even when the tenant
            // filter is off. Only for leaf tables whose every query already skipped deleted rows.
            if (SoftDeleteFilteredTypes.Contains(entityType.ClrType)
                && entityType.ClrType.GetProperty(nameof(Domain.Entities.ISoftDeletable.DeletedAt)) is { } deletedAt)
            {
                body = Expression.AndAlso(
                    Expression.Equal(Expression.Property(param, deletedAt), Expression.Constant(null, typeof(DateTime?))),
                    body);
            }

            // EF allows one filter per entity, so the branch rule is AND-ed into the same lambda.
            var branchProp = entityType.ClrType.GetProperty("BranchId");
            if (BranchScopedTypes.Contains(entityType.ClrType) && branchProp is not null)
            {
                var branchDisabled = Expression.Property(ctx, nameof(BranchFilterDisabled));
                var currentBranch = Expression.Property(ctx, nameof(CurrentBranchId));
                var branchValue = Expression.Property(param, branchProp);
                Expression branchMatch = branchProp.PropertyType == typeof(ulong?)
                    ? Expression.OrElse(
                        Expression.Equal(branchValue, Expression.Constant(null, typeof(ulong?))),
                        Expression.Equal(branchValue, Expression.Convert(currentBranch, typeof(ulong?))))
                    : Expression.Equal(branchValue, currentBranch);
                body = Expression.AndAlso(body, Expression.OrElse(branchDisabled, branchMatch));
            }

            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(Expression.Lambda(body, param));
        }
    }

    // ── Saving ──────────────────────────────────────────────────────────────
    // UpdatedAt is stamped on every modified row.
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        Configurations.AppendOnlyGuard.Check(ChangeTracker);
        StampUpdatedAt();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        Configurations.AppendOnlyGuard.Check(ChangeTracker);
        StampUpdatedAt();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    private void StampUpdatedAt()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Domain.Entities.BaseEntity>())
            if (entry.State == EntityState.Modified) entry.Entity.UpdatedAt = now;
    }

    // ── Id generation ───────────────────────────────────────────────────────
    // Non-Postgres providers only (the SQLite test db; Postgres uses HiLo sequences, ARCH-004).
    // A new row still carrying Id 0 gets MAX(Id)+1 the moment it starts being tracked, so several
    // new rows can be added in one unit of work without clashing on key 0. MAX is read once per
    // table per context and then incremented locally. This is NOT safe under concurrent writers,
    // which is why Postgres no longer uses it. Code that already sets an Id is left alone.
    private readonly Dictionary<string, ulong> _nextIds = [];

    private void AssignIdOnTracking(object? sender, Microsoft.EntityFrameworkCore.ChangeTracking.EntityTrackingEventArgs e)
    {
        if (e.State != EntityState.Added) return;
        var key = e.Entry.Metadata.FindPrimaryKey();
        if (key is not { Properties.Count: 1 } || key.Properties[0].Name != "Id" || key.Properties[0].ClrType != typeof(ulong))
            return;

        var idProp = e.Entry.Property("Id");
        if ((ulong)idProp.CurrentValue! != 0UL) return;

        var table = e.Entry.Metadata.GetTableName();
        if (table is null) return;
        var schema = e.Entry.Metadata.GetSchema();
        var qualified = schema is null ? $"\"{table}\"" : $"\"{schema}\".\"{table}\"";

        if (!_nextIds.TryGetValue(qualified, out var next))
            next = ReadMaxId(qualified, IdColumn(e.Entry.Metadata)) + 1;

        // Never hand out an id an explicitly-numbered row in this context already holds.
        var trackedMax = ChangeTracker.Entries()
            .Where(x => x.Metadata == e.Entry.Metadata)
            .Select(x => (ulong)x.Property("Id").CurrentValue!)
            .DefaultIfEmpty(0UL)
            .Max();
        next = Math.Max(next, trackedMax + 1);

        idProp.CurrentValue = next;
        _nextIds[qualified] = next + 1;
    }

    /// <summary>The database column behind the entity's Id (renamed for some tables, e.g. PostId).</summary>
    private static string IdColumn(Microsoft.EntityFrameworkCore.Metadata.IEntityType type)
    {
        var table = type.GetTableName();
        var column = table is null ? null
            : type.FindProperty("Id")?.GetColumnName(Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, type.GetSchema()));
        return column ?? "Id";
    }

    private ulong ReadMaxId(string qualifiedTable, string idColumn = "Id")
    {
        var conn = Database.GetDbConnection();
        var wasOpen = conn.State == System.Data.ConnectionState.Open;
        if (!wasOpen) conn.Open();
        try
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"SELECT COALESCE(MAX(\"{idColumn}\"), 0) FROM {qualifiedTable}";
            if (Database.CurrentTransaction is { } tx)
                cmd.Transaction = Microsoft.EntityFrameworkCore.Storage.DbContextTransactionExtensions.GetDbTransaction(tx);
            var result = cmd.ExecuteScalar();
            return result is DBNull or null ? 0UL : (ulong)Convert.ToDecimal(result);
        }
        finally
        {
            if (!wasOpen) conn.Close();
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

/// <summary>
/// Value comparer for jsonb <see cref="JsonDocument"/> columns. JsonDocument is immutable, so
/// reference snapshots are safe; equality by raw text avoids spurious updates when a property is
/// re-assigned an equal document.
/// </summary>
public class JsonDocumentComparer : Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<JsonDocument>
{
    public JsonDocumentComparer() : base(
        (a, b) => ReferenceEquals(a, b) || (a != null && b != null && a.RootElement.GetRawText() == b.RootElement.GetRawText()),
        v => v == null ? 0 : v.RootElement.GetRawText().GetHashCode(),
        v => v) { }
}
