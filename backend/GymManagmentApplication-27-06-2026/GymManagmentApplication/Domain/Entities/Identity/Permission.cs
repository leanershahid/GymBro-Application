namespace GymManagmentApplication.Domain.Entities.Identity;

public class Permission
{
    public ulong Id { get; set; }
    public string Module { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string? Label { get; set; }

    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
