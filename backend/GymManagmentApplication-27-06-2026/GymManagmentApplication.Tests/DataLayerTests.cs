using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Entities.Billing;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace GymManagmentApplication.Tests;

/// <summary>Tenant isolation, nullable-tenant and soft-delete rules of the global query filter (ARCH-035/036/037).</summary>
public class TenantFilterTests : IDisposable
{
    private readonly TestDb _db = new();

    public TenantFilterTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        _db.AddMember(100, tenantId: 1);
        _db.AddMember(200, tenantId: 2);
    }

    [Fact]
    public void A_gym_admin_never_sees_another_gyms_rows()
    {
        using var gym1 = _db.Create(new FakeUser { TenantId = 1 });
        Assert.Equal([100UL], gym1.Users.Select(u => u.Id).ToList());
        Assert.All(gym1.Branches.ToList(), b => Assert.Equal(1UL, b.TenantId));

        using var noTenant = _db.Create(new FakeUser { TenantId = null });
        Assert.Empty(noTenant.Users.ToList()); // a token without a tenant claim fails closed

        using var super = _db.Create(new FakeUser { Role = "superadmin", TenantId = 1 });
        Assert.Equal(2, super.Users.Count());

        using var bypass = _db.Create(new FakeUser { TenantId = 1 });
        Assert.Equal(2, bypass.Users.AcrossTenants().Count());
    }

    [Fact]
    public void Null_tenant_is_shared_only_for_library_tables()
    {
        using (var seed = _db.Create(null))
        {
            seed.Exercises.Add(new Exercise { TenantId = null, Name = "Squat", Slug = "squat" });
            seed.Exercises.Add(new Exercise { TenantId = 2, Name = "Gym 2 move", Slug = "g2" });
            seed.HealthMetrics.Add(new HealthMetric { TenantId = null, ClientId = 100, MetricDate = DateOnly.FromDateTime(DateTime.UtcNow) });
            seed.HealthMetrics.Add(new HealthMetric { TenantId = 1, ClientId = 100, MetricDate = DateOnly.FromDateTime(DateTime.UtcNow) });
            seed.SaveChanges();
        }

        using var gym1 = _db.Create(new FakeUser { TenantId = 1 });
        Assert.Equal(["squat"], gym1.Exercises.Select(e => e.Slug).ToList());
        Assert.Equal([1UL], gym1.HealthMetrics.Select(m => m.TenantId!.Value).ToList());

        using var background = _db.Create(null);
        Assert.Equal(2, background.HealthMetrics.Count());
    }

    [Fact]
    public void Soft_deleted_reviews_and_addresses_are_hidden_by_the_filter()
    {
        using (var seed = _db.Create(null))
        {
            var category = new ShopCategory { TenantId = 1, Name = "Gear", Slug = "gear" };
            var product = new ShopProduct { TenantId = 1, Name = "Bottle", Slug = "bottle", Sku = "B1", Category = category };
            seed.ShopProducts.Add(product);
            seed.ShopReviews.Add(new ShopReview { TenantId = 1, Product = product, UserId = 100, Rating = 5 });
            seed.ShopReviews.Add(new ShopReview { TenantId = 1, Product = product, UserId = 100, Rating = 1, DeletedAt = DateTime.UtcNow });
            seed.ShopAddresses.Add(new ShopAddress { TenantId = 1, UserId = 100, FullName = "A", Line1 = "x", City = "c", State = "s", PostalCode = "1", Phone = "1", DeletedAt = DateTime.UtcNow });
            seed.SaveChanges();
        }

        using var gym1 = _db.Create(new FakeUser { TenantId = 1 });
        Assert.Equal([(short)5], gym1.ShopReviews.Select(r => r.Rating).ToList());
        Assert.Empty(gym1.ShopAddresses.ToList());
        Assert.Equal(2, gym1.ShopReviews.AcrossTenants().Count());

        // User keeps an explicit check (not filtered) so invoices/orders still load a deleted member.
        using (var seed = _db.Create(null))
        {
            seed.Users.Single(u => u.Id == 100).DeletedAt = DateTime.UtcNow;
            seed.SaveChanges();
        }
        using var again = _db.Create(new FakeUser { TenantId = 1 });
        Assert.Equal(1, again.Users.Count());
        Assert.Equal(0, again.Users.NotDeleted().Count());
    }

    public void Dispose() => _db.Dispose();
}

/// <summary>The shared coupon rules used by the shop and membership pricing.</summary>
public class CouponRuleTests
{
    private static readonly DateTime Now = new(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(CouponType.Percentage, 10, null, 1000, 100)]
    [InlineData(CouponType.Percentage, 50, 200.0, 1000, 200)]   // capped by MaxDiscount
    [InlineData(CouponType.Fixed, 300, null, 1000, 300)]
    [InlineData(CouponType.Fixed, 300, null, 250, 250)]       // never more than the amount
    [InlineData(CouponType.Percentage, 15, null, 99.99, 15)]  // rounded to paise
    [InlineData(CouponType.Fixed, 100, null, 0, 0)]
    public void Discount_is_percentage_or_fixed_capped_and_never_exceeds_the_amount(
        CouponType type, double value, double? max, double amount, double expected)
    {
        var coupon = new Coupon { Type = type, Value = (decimal)value, MaxDiscount = (decimal?)max };
        Assert.Equal((decimal)expected, CouponRules.CalculateDiscount(coupon, (decimal)amount));
    }

    [Fact]
    public void Validity_rules_are_checked_in_order()
    {
        Assert.Null(CouponRules.Check(new Coupon { IsActive = true }, 100, Now));
        Assert.Equal("Coupon code is invalid", CouponRules.Check(new Coupon { IsActive = false }, 100, Now));
        Assert.Equal("This coupon is not active yet", CouponRules.Check(new Coupon { ValidFrom = Now.AddDays(1) }, 100, Now));
        Assert.Equal("This coupon has expired", CouponRules.Check(new Coupon { ValidUntil = Now.AddDays(-1) }, 100, Now));
        Assert.Equal("This coupon has reached its usage limit", CouponRules.Check(new Coupon { MaxUses = 5, UsesCount = 5 }, 100, Now));
        Assert.StartsWith("A minimum order of", CouponRules.Check(new Coupon { MinOrder = 500 }, 100, Now));
        Assert.Null(CouponRules.Check(new Coupon { MinOrder = 500 }, 500, Now));
    }

    [Fact]
    public void Codes_are_normalised() => Assert.Equal("SAVE10", CouponRules.NormalizeCode("  save10 "));
}

/// <summary>Module grants decide what CanAsync (behind RequireModule) allows.</summary>
public class AccessTests : IDisposable
{
    private readonly TestDb _db = new();

    public AccessTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        _db.AddMember(100, tenantId: 1);
        using var seed = _db.Create(null);
        var members = new Module { Key = "admin.members", Name = "Members", App = ModuleCatalog.AdminApp, ApiModules = "members,attendance" };
        var shop = new Module { Key = "admin.shop", Name = "Shop", App = ModuleCatalog.AdminApp, ApiModules = "shop" };
        seed.Modules.AddRange(members, shop);
        seed.SaveChanges();
        seed.RoleModuleGrants.Add(new RoleModuleGrant { TenantId = 1, RoleId = 11, ModuleId = members.Id, CanView = true, CanEdit = false });
        // A grant on the same role id but stamped with another tenant must not count.
        seed.RoleModuleGrants.Add(new RoleModuleGrant { TenantId = 2, RoleId = 11, ModuleId = shop.Id, CanView = true, CanEdit = true });
        seed.SaveChanges();
    }

    private AccessService Service(AppDbContext db) =>
        new(db, new FakeUser { Role = "client", UserId = 100 }, new MemoryCache(new MemoryCacheOptions()));

    [Fact]
    public async Task Grants_allow_only_the_granted_actions_of_the_granted_modules()
    {
        using var db = _db.Create(new FakeUser { Role = "client", UserId = 100 });
        var access = Service(db);
        Assert.True(await access.CanAsync(100, "client", "members", "view"));
        Assert.True(await access.CanAsync(100, "client", "attendance", "view"));
        Assert.False(await access.CanAsync(100, "client", "members", "edit"));
        Assert.False(await access.CanAsync(100, "client", "members", "bogus"));
        Assert.False(await access.CanAsync(100, "client", "shop", "view"));
        Assert.False(await access.CanAsync(100, "client", "members", "view", apps: ["member"]));
    }

    [Fact]
    public async Task Super_admin_can_do_everything()
    {
        using var db = _db.Create(new FakeUser { Role = "superadmin" });
        Assert.True(await Service(db).CanAsync(999, "superadmin", "anything", "delete"));
    }

    public void Dispose() => _db.Dispose();
}

/// <summary>Class booking capacity and waitlist promotion.</summary>
public class ClassCapacityTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly ulong _classId;

    public ClassCapacityTests()
    {
        _db.SeedGym(1);
        _db.AddMember(100);
        _db.AddMember(101);
        _db.AddMember(102);
        using var seed = _db.Create(null);
        var type = new ClassType { TenantId = 1, Name = "Spin" };
        var gymClass = new GymClass
        {
            TenantId = 1, BranchId = 11, ClassType = type, Title = "Spin",
            StartsAt = DateTime.UtcNow.AddDays(1), EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1), MaxCapacity = 1,
        };
        seed.GymClasses.Add(gymClass);
        seed.SaveChanges();
        _classId = gymClass.Id;
    }

    private async Task Book(ulong clientId)
    {
        var me = new FakeUser { Role = "client", UserId = clientId };
        using var db = _db.Create(me);
        await new ClassService(db, me, new Notifier(db, me)).BookAsync(_classId, new BookClassRequest());
    }

    private Dictionary<ulong, BookingStatus> Statuses()
    {
        using var db = _db.Create(null);
        return db.ClassBookings.Where(b => b.ClassId == _classId && b.Status != BookingStatus.Cancelled)
            .ToDictionary(b => b.ClientId, b => b.Status);
    }

    [Fact]
    public async Task A_full_class_waitlists_and_a_cancellation_promotes_the_first_waiting_member()
    {
        await Book(100);
        await Book(101);
        await Book(102);
        Assert.Equal(BookingStatus.Booked, Statuses()[100]);
        Assert.Equal(BookingStatus.Waitlisted, Statuses()[101]);
        Assert.Equal(BookingStatus.Waitlisted, Statuses()[102]);

        await Assert.ThrowsAnyAsync<Exception>(() => Book(100)); // already booked

        var me = new FakeUser { Role = "client", UserId = 100 };
        using (var db = _db.Create(me))
            await new ClassService(db, me, new Notifier(db, me)).CancelBookingAsync(_classId, null);

        var after = Statuses();
        Assert.False(after.ContainsKey(100));
        Assert.Equal(BookingStatus.Booked, after[101]);
        Assert.Equal(BookingStatus.Waitlisted, after[102]);

        using var check = _db.Create(null);
        var c = check.GymClasses.Single(x => x.Id == _classId);
        Assert.Equal(1, c.EnrolledCount);
        Assert.Equal(1, c.WaitlistCount);
    }

    public void Dispose() => _db.Dispose();
}

/// <summary>
/// The model as the Npgsql provider builds it (no connection needed) — the part of ARCH-056 that
/// SQLite can't show: jsonb mapping, the jsonb comparer, the dropped tables (ARCH-039).
/// </summary>
public class PostgresModelTests
{
    private static AppDbContext NpgsqlContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        AppDbContextOptions.Configure(options, AppDbContextOptions.BuildDataSource("Host=localhost;Database=model_only"), false);
        return new AppDbContext(options.Options);
    }

    [Fact]
    public void Model_uses_jsonb_and_the_json_comparer()
    {
        using var db = NpgsqlContext();
        var specs = db.Model.FindEntityType(typeof(ShopProduct))!.FindProperty(nameof(ShopProduct.Specifications))!;
        Assert.Equal("jsonb", specs.GetColumnType());

        var jsonProps = db.Model.GetEntityTypes().SelectMany(t => t.GetProperties())
            .Where(p => p.ClrType == typeof(System.Text.Json.JsonDocument)).ToList();
        Assert.NotEmpty(jsonProps);
        Assert.All(jsonProps, p => Assert.IsType<JsonDocumentComparer>(p.GetValueComparer()));
    }

    [Fact]
    public void Unused_tables_are_gone_from_the_model()
    {
        using var db = NpgsqlContext();
        var tables = db.Model.GetEntityTypes().Select(t => t.GetTableName()).ToHashSet();
        foreach (var dropped in new[] { "Webhooks", "PayrollSlips", "AiChatSessions", "Lockers", "UiThemes", "WorkoutLogSets" })
            Assert.DoesNotContain(dropped, tables);
        Assert.Contains("WorkoutBookmarks", tables);
    }

    [Fact]
    public void Ulong_ids_come_from_per_table_sequences_and_composite_keys_are_untouched()
    {
        using var db = NpgsqlContext();
        var keyed = db.Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && t.FindPrimaryKey() is { Properties: [{ Name: "Id" } p] } && p.ClrType == typeof(ulong))
            .ToList();
        Assert.NotEmpty(keyed);
        foreach (var type in keyed)
        {
            var id = type.FindProperty("Id")!;
            Assert.Equal(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.OnAdd, id.ValueGenerated);
            Assert.NotNull(id.GetValueGeneratorFactory());
            var seq = db.Model.FindSequence(AppDbContext.IdSequenceName(type.GetTableName()!));
            Assert.NotNull(seq);
            Assert.Equal(IdSequenceValueGenerator.BlockSize, seq!.IncrementBy);
        }

        var counter = db.Model.FindEntityType(typeof(GymManagmentApplication.Domain.Entities.Platform.TenantCounter))!;
        Assert.All(counter.FindPrimaryKey()!.Properties, p => Assert.Equal(Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never, p.ValueGenerated));
    }

    [Fact]
    public void Model_has_no_changes_missing_from_the_migrations()
    {
        using var db = NpgsqlContext();
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
