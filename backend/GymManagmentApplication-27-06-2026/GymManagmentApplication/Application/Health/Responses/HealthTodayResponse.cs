namespace GymManagmentApplication.Application.Health.Responses;

public class HealthRingResponse
{
    public double Current { get; set; }
    public double Goal { get; set; }
}

public class HealthRingsResponse
{
    public HealthRingResponse Move { get; set; } = default!;
    public HealthRingResponse Train { get; set; } = default!;
    public HealthRingResponse Stand { get; set; } = default!;
}

public class HealthStatsResponse
{
    public ushort? Bpm { get; set; }
    public decimal? WaterLiters { get; set; }
    public decimal? SleepHours { get; set; }
    public byte? EnergyPct { get; set; }
}

public class HealthTodayResponse
{
    public HealthRingsResponse Rings { get; set; } = default!;
    public HealthStatsResponse Stats { get; set; } = default!;
    public int StreakDays { get; set; }

    /// <summary>Templated tip bucketed off today's recovery score — admin-configurable, not a live LLM.</summary>
    public string? CoachTip { get; set; }
}

public class HealthAdminOverviewResponse
{
    public int ClientsTrackedToday { get; set; }
    public double? AvgRecoveryScore { get; set; }
    public double? AvgSleepHours { get; set; }
    public double? AvgSteps { get; set; }
    public List<ClientHealthRow> Clients { get; set; } = [];
}

public class ClientHealthRow
{
    public ulong UserId { get; set; }
    public string Name { get; set; } = default!;
    public uint? Steps { get; set; }
    public decimal? SleepHours { get; set; }
    public byte? RecoveryScore { get; set; }
}
