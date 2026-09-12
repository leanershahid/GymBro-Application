namespace GymManagmentApplication.Domain.Entities.Scheduling;

public class ClassType
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public short? DurationMin { get; set; }
    public short? MaxCapacity { get; set; }
    public string? Color { get; set; }
    public string? IconUrl { get; set; }
    public bool IsActive { get; set; } = true;

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<GymClass> Classes { get; set; } = [];
}
