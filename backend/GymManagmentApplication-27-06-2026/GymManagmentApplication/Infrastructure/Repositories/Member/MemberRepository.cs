using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories.Member;

public class MemberRepository(AppDbContext db) : IMemberRepository
{
    public async Task<(List<User> Items, int Total)> GetAllAsync(MemberSearchRequest request)
    {
        var q = db.Users.Where(u => u.DeletedAt == null && u.Role != null && u.Role.Slug == "client");

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<UserStatus>(request.Status, true, out var status))
            q = q.Where(u => u.Status == status);

        if (!string.IsNullOrWhiteSpace(request.Query))
            q = q.Where(u =>
                (u.FirstName != null && u.FirstName.Contains(request.Query)) ||
                (u.LastName  != null && u.LastName.Contains(request.Query))  ||
                (u.Email     != null && u.Email.Contains(request.Query)));

        var total = await q.CountAsync();
        var items = await q
            .OrderBy(u => u.FirstName)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return (items, total);
    }

    public async Task<User> CreateAsync(User user)
    {
        var maxId = await db.Users.MaxAsync(u => (ulong?)u.Id) ?? 0;
        user.Id        = maxId + 1;
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<User?> GetByIdAsync(ulong id) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.DeletedAt == null);

    public async Task<User?> GetByEmailAsync(string email) =>
        await db.Users.FirstOrDefaultAsync(u =>
            u.Email != null && u.Email.ToLower() == email.ToLower() && u.DeletedAt == null);

    public async Task<User?> UpdateAsync(User user)
    {
        user.UpdatedAt = DateTime.UtcNow;
        db.Users.Update(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<bool> SoftDeleteAsync(ulong id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null || user.DeletedAt != null) return false;
        user.DeletedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }
}
