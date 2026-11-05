namespace GymManagmentApplication.Filters;

/// <summary>
/// The one mapping from HTTP method to module action used by every access filter
/// (<see cref="AuthorizeRolesAttribute"/> and <see cref="RequireModuleAttribute"/>):
/// GET/HEAD = view, POST = create, PUT/PATCH = edit, DELETE = delete. Any other method maps to
/// null and is denied by both filters (CORS preflight OPTIONS never reaches them — the CORS
/// middleware answers it).
/// <para>
/// Module keys: <see cref="PermissionModuleAttribute"/> and <see cref="RequireModuleAttribute"/> name
/// API permission keys from <see cref="Application.Access.ModuleCatalog"/> (a module's "ApiModules"
/// column). A controller should use the same key in both.
/// </para>
/// </summary>
public static class ModuleActions
{
    public static string? For(string httpMethod) => httpMethod.ToUpperInvariant() switch
    {
        "GET" or "HEAD"  => "view",
        "POST"           => "create",
        "PUT" or "PATCH" => "edit",
        "DELETE"         => "delete",
        _                => null
    };
}
