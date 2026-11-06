using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Member.Services;

/// <summary>
/// Member queries and writes on the DbContext (ARCH-023: replaces the thin IMemberRepository,
/// same SQL and the same UpdatedAt stamping).
/// </summary>
public static class MemberQueries
{
    /// <summary>Client accounts matching the search, one page, with their branch (read-only).</summary>
    public static async Task<(List<User> Items, int Total)> SearchMembersAsync(this IAppDbContext db, MemberSearchRequest request, ulong? onlyAssignedToTrainerUserId = null)
    {
        var q = db.Users.Where(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == "client");

        if (onlyAssignedToTrainerUserId is { } trainerUserId)
        {
            var assigned = db.AssignedClientIds(trainerUserId);
            q = q.Where(u => assigned.Contains(u.Id));
        }

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<UserStatus>(request.Status, true, out var status))
            q = q.Where(u => u.Status == status);

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            if (db.Database.IsNpgsql())
            {
                // Case-insensitive on Postgres (ARCH-043); a pg_trgm GIN index can serve ILIKE later.
                var pattern = "%" + request.Query.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
                q = q.Where(u =>
                    (u.FirstName != null && EF.Functions.ILike(u.FirstName, pattern)) ||
                    (u.LastName  != null && EF.Functions.ILike(u.LastName, pattern))  ||
                    (u.Email     != null && EF.Functions.ILike(u.Email, pattern)));
            }
            else
                q = q.Where(u =>
                    (u.FirstName != null && u.FirstName.Contains(request.Query)) ||
                    (u.LastName  != null && u.LastName.Contains(request.Query))  ||
                    (u.Email     != null && u.Email.Contains(request.Query)));
        }

        var total = await q.CountAsync();
        // Read-only list: no change tracking (ARCH-043).
        var items = await q
            .AsNoTracking()
            .Include(u => u.Branch)
            .OrderBy(u => u.FirstName)
            .Page(request.PageNumber, request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    /// <summary>Saves a member's profile (marks the whole entity modified, stamps UpdatedAt).</summary>
    public static async Task<User> SaveMemberAsync(this IAppDbContext db, User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        db.Users.Update(user);
        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>Archives a member; false when not found or already archived.</summary>
    public static async Task<bool> SoftDeleteMemberAsync(this IAppDbContext db, ulong id)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id);
        if (user is null || user.DeletedAt != null) return false;
        user.DeletedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }
}
