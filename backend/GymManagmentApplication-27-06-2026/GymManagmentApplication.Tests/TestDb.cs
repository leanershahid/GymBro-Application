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
/// Good for exercising services and query filters; Postgres-only SQL isn't covered.
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
        new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_conn).Options, user);

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
