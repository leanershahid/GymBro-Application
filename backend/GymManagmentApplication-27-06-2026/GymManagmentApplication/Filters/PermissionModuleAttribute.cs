namespace GymManagmentApplication.Filters;

/// <summary>
/// Names the module (as used in the role/module access matrix) that a controller or action
/// belongs to. <see cref="AuthorizeRolesAttribute"/> uses it to let staff and custom roles in
/// when an admin has granted that role the matching action on this module.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class PermissionModuleAttribute(string module) : Attribute
{
    public string Module { get; } = module;
}
