namespace GymManagmentApplication.Application.ModuleAccess.Requests;

public class SetModuleAccessRequest
{
    public ulong TenantId { get; set; }
    public ulong RoleId { get; set; }
    public string Module { get; set; } = default!;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanExport { get; set; }
}

public class BulkSetModuleAccessRequest
{
    public ulong TenantId { get; set; }
    public ulong RoleId { get; set; }
    public List<ModuleAccessEntry> Modules { get; set; } = [];
}

public class ModuleAccessEntry
{
    public string Module { get; set; } = default!;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanExport { get; set; }
}

public class CheckModuleAccessRequest
{
    public ulong RoleId { get; set; }
    public string Module { get; set; } = default!;
    public string Action { get; set; } = default!; // "view" | "create" | "edit" | "delete" | "export"
}
