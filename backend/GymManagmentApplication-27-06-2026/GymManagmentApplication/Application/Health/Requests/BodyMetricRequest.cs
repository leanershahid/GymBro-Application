namespace GymManagmentApplication.Application.Health.Requests;

public class BodyMetricRequest
{
    public DateOnly? Date { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPct { get; set; }
    public ushort? RestingHr { get; set; }
    public decimal? SleepHours { get; set; }
    public ushort? HydrationMl { get; set; }
    public uint? Steps { get; set; }
    public byte? Mood { get; set; }
    public string? Notes { get; set; }
}
