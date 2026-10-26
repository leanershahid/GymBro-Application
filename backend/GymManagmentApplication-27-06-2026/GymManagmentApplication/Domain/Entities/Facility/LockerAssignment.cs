namespace GymManagmentApplication.Domain.Entities.Facility;

public class LockerAssignment
{
    public ulong Id { get; set; }
    /// <summary>Owning gym (nullable: rows written before this was mapped have none).</summary>
    public ulong? TenantId { get; set; }
    public ulong LockerId { get; set; }
    public ulong UserId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReleasedAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Locker Locker { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
