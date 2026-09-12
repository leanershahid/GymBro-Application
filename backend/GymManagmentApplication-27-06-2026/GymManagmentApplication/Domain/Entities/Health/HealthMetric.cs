using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.Health;

public class HealthMetric
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public DateOnly MetricDate { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPct { get; set; }
    public decimal? Bmi { get; set; }
    public ushort? RestingHr { get; set; }
    public ushort? BloodPressureSys { get; set; }
    public ushort? BloodPressureDia { get; set; }
    public decimal? SleepHours { get; set; }
    public byte? StressLevel { get; set; }
    public ushort? HydrationMl { get; set; }
    public uint? Steps { get; set; }
    public ushort? CaloriesBurned { get; set; }
    public byte? RecoveryScore { get; set; }
    public byte? Mood { get; set; }
    public string? Notes { get; set; }
    public MetricSource Source { get; set; } = MetricSource.Manual;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Identity.User Client { get; set; } = default!;
}
