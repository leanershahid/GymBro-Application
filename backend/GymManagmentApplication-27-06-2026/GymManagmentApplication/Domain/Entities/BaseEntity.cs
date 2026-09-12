namespace GymManagmentApplication.Domain.Entities;

public abstract class BaseEntity
{
    public ulong Id { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public abstract class BaseEntityNoTimestamps
{
    public ulong Id { get; set; }
}
