using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class Exercise : BaseEntity
{
    public ulong? TenantId { get; set; }
    public ulong? CreatedBy { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public ExerciseCategory Category { get; set; } = ExerciseCategory.Strength;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
    public string? VideoUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public bool IsCustom { get; set; }
    public bool IsActive { get; set; } = true;
    public JsonDocument? Tags { get; set; }
    public JsonDocument? Meta { get; set; }

    public Core.Tenant? Tenant { get; set; }
    public Identity.User? Creator { get; set; }
    public ICollection<ExerciseMuscle> ExerciseMuscles { get; set; } = [];
    public ICollection<ExerciseEquipment> ExerciseEquipments { get; set; } = [];
}
