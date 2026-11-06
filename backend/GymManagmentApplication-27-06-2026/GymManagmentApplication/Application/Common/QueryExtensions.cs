using System.Runtime.CompilerServices;
using GymManagmentApplication.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Common;

/// <summary>Shared query helpers for the two cross-cutting rules: tenant isolation and soft delete.</summary>
public static class QueryExtensions
{
    /// <summary>
    /// Live rows only (<c>DeletedAt == null</c>). Prefer this to a hand-written predicate (ARCH-037).
    /// </summary>
    public static IQueryable<T> NotDeleted<T>(this IQueryable<T> query) where T : class, ISoftDeletable =>
        query.Where(e => e.DeletedAt == null);

    /// <summary>
    /// The one audited way to read across tenants (ARCH-035). EF Core 9 has a single query filter
    /// per entity, so this drops the tenant, the branch AND the soft-delete rule at once: the caller
    /// must add its own <c>TenantId</c> / <c>DeletedAt</c> predicates. The query is tagged with the
    /// calling member, so every bypass is visible in SQL logs and greppable as
    /// <c>AcrossTenants(</c>.
    /// </summary>
    public static IQueryable<T> AcrossTenants<T>(this IQueryable<T> query, [CallerMemberName] string caller = "")
        where T : class =>
        query.IgnoreQueryFilters().TagWith("tenant-filter-bypass: " + caller);
}
