namespace GymManagmentApplication.Application.Exercise.Responses;

public class ExerciseResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public string? Description { get; set; }
    public string? Instructions { get; set; }
    public string Category { get; set; } = default!;
    public string Difficulty { get; set; } = default!;
    public string? VideoUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public bool IsCustom { get; set; }
    public List<string> Tags { get; set; } = [];
    public List<MuscleResponse> Muscles { get; set; } = [];
    public List<EquipmentResponse> Equipment { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}

public class MuscleResponse
{
    public ushort Id { get; set; }
    public string Name { get; set; } = default!;
    public string Role { get; set; } = default!;
}

public class EquipmentResponse
{
    public ushort Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Category { get; set; }
}

public class ExerciseTagResponse
{
    public string Tag { get; set; } = default!;
    public int Count { get; set; }
}

public class MuscleGroupResponse
{
    public ushort Id { get; set; }
    public string Name { get; set; } = default!;
}

public class VideoAnnotationResponse
{
    public string VideoUrl { get; set; } = default!;
    public List<object> Annotations { get; set; } = [];
}
