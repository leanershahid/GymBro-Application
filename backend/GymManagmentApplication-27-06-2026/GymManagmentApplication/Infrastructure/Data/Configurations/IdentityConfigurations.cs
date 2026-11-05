using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Users, roles, sessions and the module-access tables.

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        // Email stays globally unique on purpose: it is the login key, and login happens
        // before we know which gym the user belongs to.
        // Unique among live accounts only, so a soft-deleted member's email can be used again.
        b.HasIndex(u => u.Email).IsUnique().HasFilter("\"DeletedAt\" IS NULL");
        b.HasIndex(u => u.Uuid).IsUnique();
        b.HasOne(u => u.Tenant).WithMany(t => t.Users).HasForeignKey(u => u.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(u => u.Role).WithMany(r => r.Users).HasForeignKey(u => u.RoleId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> b) =>
        b.HasIndex(r => new { r.TenantId, r.Slug }).IsUnique();
}

public sealed class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> b) =>
        b.HasKey(e => new { e.RoleId, e.PermissionId });
}

public sealed class UserSessionConfiguration : IEntityTypeConfiguration<UserSession>
{
    public void Configure(EntityTypeBuilder<UserSession> b) =>
        b.HasIndex(s => s.TokenHash).IsUnique();
}

public sealed class AuthCodeConfiguration : IEntityTypeConfiguration<AuthCode>
{
    public void Configure(EntityTypeBuilder<AuthCode> b)
    {
        b.HasIndex(c => new { c.UserId, c.Purpose });
        b.HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> b)
    {
        b.HasIndex(ur => new { ur.UserId, ur.RoleId }).IsUnique();
        b.HasOne(ur => ur.User).WithMany().HasForeignKey(ur => ur.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(ur => ur.Role).WithMany().HasForeignKey(ur => ur.RoleId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>Legacy role matrix — unique per tenant + role + module.</summary>
public sealed class ModuleAccessConfiguration : IEntityTypeConfiguration<ModuleAccess>
{
    public void Configure(EntityTypeBuilder<ModuleAccess> b)
    {
        b.HasIndex(m => new { m.TenantId, m.RoleId, m.Module }).IsUnique();
        b.HasOne(m => m.Tenant).WithMany().HasForeignKey(m => m.TenantId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(m => m.Role).WithMany().HasForeignKey(m => m.RoleId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// <summary>Module master — one row per menu item/page/tab; grants point at rows by FK.</summary>
public sealed class ModuleConfiguration : IEntityTypeConfiguration<Module>
{
    public void Configure(EntityTypeBuilder<Module> b)
    {
        b.HasIndex(m => m.Key).IsUnique();
        b.HasOne(m => m.Parent).WithMany().HasForeignKey(m => m.ParentId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class UserModuleAccessConfiguration : IEntityTypeConfiguration<UserModuleAccess>
{
    public void Configure(EntityTypeBuilder<UserModuleAccess> b) =>
        b.HasIndex(a => new { a.UserId, a.ModuleId }).IsUnique();
}

public sealed class RoleModuleGrantConfiguration : IEntityTypeConfiguration<RoleModuleGrant>
{
    public void Configure(EntityTypeBuilder<RoleModuleGrant> b)
    {
        b.HasIndex(g => new { g.TenantId, g.RoleId, g.ModuleId }).IsUnique();
        b.HasOne(g => g.Role).WithMany().HasForeignKey(g => g.RoleId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(g => g.Module).WithMany().HasForeignKey(g => g.ModuleId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<Tenant>().WithMany().HasForeignKey(g => g.TenantId).OnDelete(DeleteBehavior.Cascade);
    }
}
