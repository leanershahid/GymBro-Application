namespace GymManagmentApplication.Domain.Entities.Training;

/// <summary>A user's saved workout (toggle). One row per user per workout template.</summary>
public class WorkoutBookmark
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public ulong WorkoutTemplateId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
