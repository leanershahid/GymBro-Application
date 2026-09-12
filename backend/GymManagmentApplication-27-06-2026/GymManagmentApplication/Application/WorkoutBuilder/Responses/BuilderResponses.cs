namespace GymManagmentApplication.Application.WorkoutBuilder.Responses;

public class SectionResponse
{
    public ulong Id { get; set; }
    public ulong WorkoutId { get; set; }
    public string? Name { get; set; }
    public string Type { get; set; } = default!;
    public byte SortOrder { get; set; }
    public byte Rounds { get; set; }
    public ushort? RestSeconds { get; set; }
}

public class BuilderConfigResponse
{
    public ulong WorkoutId { get; set; }
    public string ConfigType { get; set; } = default!;
    public object Config { get; set; } = default!;
    public DateTime UpdatedAt { get; set; }
}
