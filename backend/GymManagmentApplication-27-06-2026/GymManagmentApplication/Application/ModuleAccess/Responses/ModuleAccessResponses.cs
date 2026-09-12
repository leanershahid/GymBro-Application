namespace GymManagmentApplication.Application.ModuleAccess.Responses;

public class ModuleAccessResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong RoleId { get; set; }
    public string RoleName { get; set; } = default!;
    public string Module { get; set; } = default!;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanExport { get; set; }
    public bool IsActive { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class ModuleAccessMatrixResponse
{
    public ulong TenantId { get; set; }
    /// <summary>Key = module name, Value = list of role access rows for that module</summary>
    public Dictionary<string, List<RoleModuleRow>> Matrix { get; set; } = [];
}

public class RoleModuleRow
{
    public ulong RoleId { get; set; }
    public string RoleName { get; set; } = default!;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanExport { get; set; }
}

public class CheckAccessResponse
{
    public ulong RoleId { get; set; }
    public string Module { get; set; } = default!;
    public string Action { get; set; } = default!;
    public bool IsAllowed { get; set; }
}
