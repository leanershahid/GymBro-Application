namespace GymManagmentApplication.Application.UserModules.Responses;

public class ModuleResponse
{
    public ulong Id { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
}

public class UserModuleAccessResponse
{
    public ulong ModuleId { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public bool IsEnabled { get; set; }
    public bool CanAdd { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public DateTime? GrantedAt { get; set; }
}
