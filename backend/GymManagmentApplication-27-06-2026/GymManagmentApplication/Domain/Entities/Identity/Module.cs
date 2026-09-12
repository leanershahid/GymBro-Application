namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// A gate-able end-user feature area (e.g. "workouts", "plans") — distinct from
/// <see cref="ModuleAccess"/>, which governs per-role CRUD-action permissions
/// over admin resource categories. This is a coarse per-user on/off toggle.
/// </summary>
public class Module
{
    public ulong Id { get; set; }
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserModuleAccess> UserAccess { get; set; } = [];
}
