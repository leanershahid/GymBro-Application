namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// An additional role held by a user, on top of <see cref="User.RoleId"/>. The primary role still
/// decides which app the user signs in to and goes in the token; additional roles only add their
/// module grants.
/// </summary>
public class UserRole
{
    public ulong Id { get; set; }
    public ulong UserId { get; set; }
    public ulong RoleId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = default!;
    public Role Role { get; set; } = default!;
}
