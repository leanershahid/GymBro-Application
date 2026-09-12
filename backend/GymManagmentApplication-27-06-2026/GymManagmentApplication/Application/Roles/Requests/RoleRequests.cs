namespace GymManagmentApplication.Application.Roles.Requests;

public class CreateRoleRequest
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class UpdateRoleRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
}

public class UpdateRolePermissionsRequest
{
    public List<string> Permissions { get; set; } = [];
}

public class AssignRoleRequest
{
    public string RoleId { get; set; } = default!;
}
