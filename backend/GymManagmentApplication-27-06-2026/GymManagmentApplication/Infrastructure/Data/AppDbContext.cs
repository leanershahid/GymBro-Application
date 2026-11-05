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

public class AppDbContext : DbContext
{
    private readonly ICurrentUser? currentUser;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser? currentUser = null) : base(options)
    {
        this.currentUser = currentUser;
        ChangeTracker.Tracking += AssignIdOnTracking;
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

        // Auto-increment for ulong PKs — Id is generated in application code (MAX+1)
        // because the DB uses numeric(20,0) with no native identity/sequence strategy.
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
    // UpdatedAt is stamped on every modified row. Because ids are MAX(Id)+1 (see below), two
    // requests inserting into the same table at the same moment can pick the same id; the loser
    // gets a primary-key violation. Ids this context generated are then re-read and the save is
    // retried, instead of surfacing a 500.
    private const int MaxIdRetries = 3;

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampUpdatedAt();
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            }
            catch (DbUpdateException ex) when (attempt < MaxIdRetries && IsPrimaryKeyClash(ex) && ReassignGeneratedIds())
            {
                await Task.Delay(Random.Shared.Next(10, 60), cancellationToken);
            }
        }
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampUpdatedAt();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    private void StampUpdatedAt()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Domain.Entities.BaseEntity>())
            if (entry.State == EntityState.Modified) entry.Entity.UpdatedAt = now;
    }

    private static bool IsPrimaryKeyClash(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg
        && (pg.ConstraintName?.StartsWith("PK_", StringComparison.Ordinal) ?? false);

    /// <summary>Gives every still-Added row whose id this context generated a fresh MAX(Id)+1.</summary>
    private bool ReassignGeneratedIds()
    {
        var added = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added && _generatedIds.Contains(e.Entity))
            .ToList();
        if (added.Count == 0) return false;
        _nextIds.Clear();
        foreach (var group in added.GroupBy(e => e.Metadata))
        {
            var table = group.Key.GetTableName();
            if (table is null) continue;
            var schema = group.Key.GetSchema();
            var qualified = schema is null ? $"\"{table}\"" : $"\"{schema}\".\"{table}\"";
            var next = ReadMaxId(qualified, IdColumn(group.Key)) + 1;
            // Leave room for rows in this batch that kept explicit ids.
            var keptMax = ChangeTracker.Entries()
                .Where(x => x.Metadata == group.Key && x.State == EntityState.Added && !_generatedIds.Contains(x.Entity))
                .Select(x => (ulong)x.Property("Id").CurrentValue!)
                .DefaultIfEmpty(0UL).Max();
            next = Math.Max(next, keptMax + 1);
            foreach (var entry in group) entry.Property("Id").CurrentValue = next++;
            _nextIds[qualified] = next;
        }
        return true;
    }

    // ── Id generation ───────────────────────────────────────────────────────
    // ulong PKs are ValueGenerated.Never (numeric(20,0), no identity). A new row still carrying
    // Id 0 gets MAX(Id)+1 the moment it starts being tracked — before tracking, so several new
    // rows can be added in one unit of work without clashing on key 0. MAX is read once per
    // table per context (unfiltered, so other tenants' rows count) and then incremented
    // locally. Code that already sets an Id is left alone.
    private readonly Dictionary<string, ulong> _nextIds = [];
    private readonly HashSet<object> _generatedIds = new(ReferenceEqualityComparer.Instance);

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
        _generatedIds.Add(e.Entry.Entity);
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
