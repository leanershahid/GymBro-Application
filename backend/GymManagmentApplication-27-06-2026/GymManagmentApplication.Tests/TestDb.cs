using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Tests;

/// <summary>Caller identity for a test (what the JWT would carry).</summary>
public class FakeUser : ICurrentUser
{
    public bool IsAuthenticated { get; set; } = true;
    public ulong? UserId { get; set; } = 1;
    public string Role { get; set; } = "admin";
    public ulong? TenantId { get; set; } = 1;
    public ulong? BranchId { get; set; }
    public bool IsSuperAdmin => Role == "superadmin";
    public bool IsAdmin => IsSuperAdmin || Role == "admin";
    public bool IsDelegatedRole => IsAuthenticated && !Domain.Constants.RoleNames.IsBuiltIn(Role);
    public ulong ResolveTenantId(ulong? requested = null) => IsSuperAdmin && requested is > 0 ? requested.Value : TenantId ?? 0;
}

/// <summary>
/// The real AppDbContext model on an in-memory SQLite database (one connection per test).
/// Good for exercising services and query filters. Known SQLite/Postgres gaps (ARCH-056), bridged
/// here so the services still run: jsonb Dictionary columns (Npgsql dynamic JSON) are stored as JSON
/// text, and row locks (<c>SELECT … FOR UPDATE</c>) are dropped — SQLite serialises writers anyway.
/// Postgres-only behaviour (xmin, advisory locks, 23505 retries, migrations) still needs a real
/// Postgres run; <see cref="PostgresModelTests"/> covers what can be checked without one.
/// </summary>
public sealed class TestDb : IDisposable
{
    private readonly SqliteConnection _conn = new("DataSource=:memory:");

    public TestDb()
    {
        _conn.Open();
        using var db = Create(null);
        db.Database.EnsureCreated();
    }

    public AppDbContext Create(ICurrentUser? user) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_conn)
            .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCustomizer, SqliteModelCustomizer>()
            .AddInterceptors(StripRowLocks.Instance)
            .Options, user);

    /// <summary>Maps Npgsql-only column shapes to something SQLite can store.</summary>
    private sealed class SqliteModelCustomizer(Microsoft.EntityFrameworkCore.Infrastructure.ModelCustomizerDependencies deps)
        : Microsoft.EntityFrameworkCore.Infrastructure.RelationalModelCustomizer(deps)
    {
        public override void Customize(ModelBuilder modelBuilder, DbContext context)
        {
            base.Customize(modelBuilder, context);
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                foreach (var prop in entity.ClrType.GetProperties().Where(p => p.PropertyType == typeof(Dictionary<string, string>)))
                    modelBuilder.Entity(entity.ClrType).Property(prop.Name)
                        .HasColumnType("TEXT")
                        .HasConversion(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<Dictionary<string, string>, string>(
                            v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                            v => System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new()));
        }
    }

    /// <summary>
    /// Rewrites the few Postgres-only bits of hand-written SQL: row locks are dropped, now() and
    /// GREATEST() (tenant counters' upsert) become their SQLite equivalents.
    /// </summary>
    private sealed class StripRowLocks : Microsoft.EntityFrameworkCore.Diagnostics.DbCommandInterceptor
    {
        public static readonly StripRowLocks Instance = new();
        private static void Strip(System.Data.Common.DbCommand c) =>
            c.CommandText = c.CommandText
                .Replace(" FOR UPDATE", "", StringComparison.Ordinal)
                .Replace("now()", "CURRENT_TIMESTAMP", StringComparison.Ordinal)
                .Replace("GREATEST(", "MAX(", StringComparison.Ordinal);

        public override Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int> NonQueryExecuting(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int> result)
        { Strip(command); return result; }

        public override ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int>> NonQueryExecutingAsync(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<int> result, CancellationToken cancellationToken = default)
        { Strip(command); return ValueTask.FromResult(result); }

        public override Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader> ReaderExecuting(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader> result)
        { Strip(command); return result; }

        public override ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader>> ReaderExecutingAsync(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader> result, CancellationToken cancellationToken = default)
        { Strip(command); return ValueTask.FromResult(result); }
    }

    /// <summary>A gym with two branches and a client role.</summary>
    public void SeedGym(ulong tenantId = 1, string currency = "INR")
    {
        using var db = Create(null);
        db.Tenants.Add(new Tenant { Id = tenantId, Uuid = Guid.NewGuid().ToString(), Name = $"Gym {tenantId}", Slug = $"gym-{tenantId}", Currency = currency, Timezone = "Asia/Kolkata" });
        db.Branches.Add(new Branch { Id = tenantId * 10 + 1, TenantId = tenantId, Name = "North", Code = $"N{tenantId}" });
        db.Branches.Add(new Branch { Id = tenantId * 10 + 2, TenantId = tenantId, Name = "South", Code = $"S{tenantId}" });
        db.Roles.Add(new Role { Id = tenantId * 10 + 1, TenantId = tenantId, Name = "Client", Slug = "client" });
        db.SaveChanges();
    }

    public User AddMember(ulong id, ulong tenantId = 1, ulong? branchId = null, string? email = null)
    {
        using var db = Create(null);
        var user = new User
        {
            Id = id, TenantId = tenantId, BranchId = branchId, RoleId = tenantId * 10 + 1,
            Uuid = Guid.NewGuid().ToString(), Email = email ?? $"m{id}@test.local",
            FirstName = "Member", LastName = id.ToString(), Status = Domain.Enums.UserStatus.Active,
        };
        db.Users.Add(user);
        db.SaveChanges();
        return user;
    }

    public void Dispose() => _conn.Dispose();
}
