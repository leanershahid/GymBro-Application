namespace GymManagmentApplication.Application.UserModules.Requests;

public class ModuleToggle
{
    public string Key { get; set; } = default!;
    public bool IsEnabled { get; set; }
}

public class UpdateUserModulesRequest
{
    public List<ModuleToggle> Modules { get; set; } = [];
}
