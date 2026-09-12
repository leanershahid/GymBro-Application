namespace GymManagmentApplication.Application.Roles.Responses;

public class RoleResponse
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public List<string> Permissions { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class PermissionResponse
{
    public string Key { get; set; } = default!;
    public string Group { get; set; } = default!;
    public string Description { get; set; } = default!;
}

public class PermissionMatrixResponse
{
    public List<RolePermissionRow> Matrix { get; set; } = [];
}

public class RolePermissionRow
{
    public string RoleName { get; set; } = default!;
    public List<string> Permissions { get; set; } = [];
}
