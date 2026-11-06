namespace GymManagmentApplication.Application.Health.Responses;

public class BodyMetricResponse
{
    public DateOnly Date { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? Bmi { get; set; }
    public ushort? RestingHr { get; set; }
    public decimal? SleepHours { get; set; }
    public ushort? HydrationMl { get; set; }
    public uint? Steps { get; set; }
    public byte? Mood { get; set; }
    public string? Notes { get; set; }
}

public class JournalEntryResponse
{
    public ulong Id { get; set; }
    public DateOnly Date { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public List<string> Photos { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}
