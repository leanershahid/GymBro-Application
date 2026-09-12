namespace GymManagmentApplication.Domain.Entities.Identity;

public class RolePermission
{
    public ulong RoleId { get; set; }
    public ulong PermissionId { get; set; }

    public Role Role { get; set; } = default!;
    public Permission Permission { get; set; } = default!;
}
