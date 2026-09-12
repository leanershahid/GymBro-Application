using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Exercise.Requests;

public class ExerciseListRequest
{
    public string? Tag { get; set; }
    public ushort? MuscleId { get; set; }
    public ushort? EquipmentId { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class CreateExerciseRequest
{
    public ulong? TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public ExerciseCategory Category { get; set; } = ExerciseCategory.Strength;
    public Difficulty Difficulty { get; set; } = Difficulty.Beginner;
    public List<string>? Tags { get; set; }
    public List<ushort>? MuscleIds { get; set; }
    public List<ushort>? EquipmentIds { get; set; }
}

public class UpdateExerciseRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public ExerciseCategory? Category { get; set; }
    public Difficulty? Difficulty { get; set; }
    public List<string>? Tags { get; set; }
}

public class AnnotateVideoRequest
{
    public List<VideoAnnotation> Annotations { get; set; } = [];
}

public class VideoAnnotation
{
    public int TimeSeconds { get; set; }
    public string Text { get; set; } = default!;
}
