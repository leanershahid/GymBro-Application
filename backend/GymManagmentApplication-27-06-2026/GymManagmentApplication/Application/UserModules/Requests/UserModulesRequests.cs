namespace GymManagmentApplication.Application.UserModules.Requests;

public class ModuleToggle
{
    public string Key { get; set; } = default!;
    public bool IsEnabled { get; set; }
    public bool CanAdd { get; set; } = true;
    public bool CanEdit { get; set; } = true;
    public bool CanDelete { get; set; } = true;
}

public class UpdateUserModulesRequest
{
    public List<ModuleToggle> Modules { get; set; } = [];
}
