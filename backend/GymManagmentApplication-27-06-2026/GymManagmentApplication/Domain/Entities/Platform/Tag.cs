namespace GymManagmentApplication.Domain.Entities.Platform;

public class Tag
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Color { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
    public ICollection<Taggable> Taggables { get; set; } = [];
}
