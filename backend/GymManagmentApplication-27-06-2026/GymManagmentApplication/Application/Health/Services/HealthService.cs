using GymManagmentApplication.Application.AiCoach.Interfaces;
using GymManagmentApplication.Application.Health.Interfaces;
using GymManagmentApplication.Application.Health.Responses;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Health.Services;

public class HealthService(AppDbContext db, IAiCoachSettingsService aiCoachSettings) : IHealthService
{
    private const double MoveGoalSteps = 8000;
    private const double TrainGoalMinutes = 60;
    private const int StandGoalDefault = 12;
    private const string StandHabitName = "Stand";
    private const int StreakLookbackDays = 90;

    public async Task<HealthTodayResponse> GetTodayAsync(ulong clientId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayStart = DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var todayEnd = todayStart.AddDays(1);

        var todayMetric = await db.HealthMetrics
            .FirstOrDefaultAsync(m => m.ClientId == clientId && m.MetricDate == today);

        var trainMinutes = await db.WorkoutLogs
            .Where(w => w.ClientId == clientId && w.StartedAt >= todayStart && w.StartedAt < todayEnd)
            .SumAsync(w => (int?)(w.DurationMin ?? 0)) ?? 0;

        var standHabit = await db.HabitTrackers
            .FirstOrDefaultAsync(h => h.ClientId == clientId && h.Name.ToLower() == StandHabitName.ToLower());

        var standCurrent = 0;
        var standGoal = StandGoalDefault;
        if (standHabit is not null)
        {
            standGoal = standHabit.Target;
            standCurrent = await db.HabitLogs
                .CountAsync(l => l.HabitId == standHabit.Id && l.LogDate == today && l.Completed);
        }

        var rings = new HealthRingsResponse
        {
            Move = new HealthRingResponse { Current = todayMetric?.Steps ?? 0, Goal = MoveGoalSteps },
            Train = new HealthRingResponse { Current = trainMinutes, Goal = TrainGoalMinutes },
            Stand = new HealthRingResponse { Current = standCurrent, Goal = standGoal }
        };

        var stats = new HealthStatsResponse
        {
            Bpm = todayMetric?.RestingHr,
            WaterLiters = todayMetric?.HydrationMl is null ? null : Math.Round(todayMetric.HydrationMl.Value / 1000m, 1),
            SleepHours = todayMetric?.SleepHours,
            EnergyPct = todayMetric?.RecoveryScore
        };

        var streakDays = await ComputeStreakAsync(clientId, today);
        var coachTip = await aiCoachSettings.GetTipForScoreAsync(todayMetric?.RecoveryScore);

        return new HealthTodayResponse
        {
            Rings = rings,
            Stats = stats,
            StreakDays = streakDays,
            CoachTip = coachTip
        };
    }

    public async Task<HealthAdminOverviewResponse> GetAdminOverviewAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var todayMetrics = await db.HealthMetrics
            .Where(m => m.MetricDate == today)
            .Join(db.Users, m => m.ClientId, u => u.Id, (m, u) => new { Metric = m, User = u })
            .ToListAsync();

        var clients = todayMetrics
            .Select(x => new ClientHealthRow
            {
                UserId = x.User.Id,
                Name = $"{x.User.FirstName} {x.User.LastName}".Trim(),
                Steps = x.Metric.Steps,
                SleepHours = x.Metric.SleepHours,
                RecoveryScore = x.Metric.RecoveryScore
            })
            .OrderBy(c => c.Name)
            .ToList();

        return new HealthAdminOverviewResponse
        {
            ClientsTrackedToday = clients.Count,
            AvgRecoveryScore = clients.Any(c => c.RecoveryScore.HasValue)
                ? clients.Where(c => c.RecoveryScore.HasValue).Average(c => (double)c.RecoveryScore!.Value)
                : null,
            AvgSleepHours = clients.Any(c => c.SleepHours.HasValue)
                ? clients.Where(c => c.SleepHours.HasValue).Average(c => (double)c.SleepHours!.Value)
                : null,
            AvgSteps = clients.Any(c => c.Steps.HasValue)
                ? clients.Where(c => c.Steps.HasValue).Average(c => (double)c.Steps!.Value)
                : null,
            Clients = clients
        };
    }

    private async Task<int> ComputeStreakAsync(ulong clientId, DateOnly today)
    {
        var lookbackStart = today.AddDays(-StreakLookbackDays);

        var metricDates = await db.HealthMetrics
            .Where(m => m.ClientId == clientId && m.MetricDate >= lookbackStart && m.MetricDate <= today)
            .Select(m => m.MetricDate)
            .ToListAsync();

        var habitLogDates = await db.HabitLogs
            .Where(l => l.Habit.ClientId == clientId && l.Completed && l.LogDate >= lookbackStart && l.LogDate <= today)
            .Select(l => l.LogDate)
            .ToListAsync();

        var activeDates = metricDates.Concat(habitLogDates).ToHashSet();

        var streak = 0;
        var cursor = today;
        while (activeDates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        return streak;
    }
}
