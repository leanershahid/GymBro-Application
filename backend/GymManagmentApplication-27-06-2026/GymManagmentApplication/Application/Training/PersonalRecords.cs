using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Workout.Responses;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Training;

/// <summary>
/// Personal records, one current best per member, exercise and type. Rules (completed, non-warmup sets only):
/// <list type="bullet">
///   <item>HeaviestWeight — the most weight lifted for at least one rep</item>
///   <item>EstimatedOneRepMax — Epley: weight × (1 + reps / 30), sets of 1–12 reps (a single is the weight itself)</item>
///   <item>BestSetVolume — weight × reps in one set</item>
///   <item>MostReps — the most reps in one set without added weight (bodyweight work)</item>
/// </list>
/// The first value for an exercise/type is stored quietly; a later session that beats it (strictly)
/// updates the row and is reported as a new record.
/// </summary>
public static class PersonalRecords
{
    public const int MaxEpleyReps = 12;

    public static decimal Epley(decimal weightKg, int reps) =>
        reps <= 1 ? weightKg : Math.Round(weightKg * (1 + reps / 30m), 2);

    /// <summary>The best candidate set per (exercise, type) in these sets.</summary>
    public static List<(ulong ExerciseId, PersonalRecordType Type, decimal Value, WorkoutSetLog Set)> Candidates(IEnumerable<WorkoutSetLog> sets)
    {
        var result = new List<(ulong, PersonalRecordType, decimal, WorkoutSetLog)>();
        foreach (var g in sets.Where(s => s.Completed && s.SetType != SetType.Warmup && s.Reps is > 0).GroupBy(s => s.ExerciseId))
        {
            var weighted = g.Where(s => s.WeightKg is > 0).ToList();
            if (weighted.Count > 0)
            {
                var heaviest = weighted.OrderByDescending(s => s.WeightKg).ThenByDescending(s => s.Reps).First();
                result.Add((g.Key, PersonalRecordType.HeaviestWeight, heaviest.WeightKg!.Value, heaviest));
                var epley = weighted.Where(s => s.Reps <= MaxEpleyReps)
                    .Select(s => (Set: s, Value: Epley(s.WeightKg!.Value, s.Reps!.Value))).OrderByDescending(x => x.Value).FirstOrDefault();
                if (epley.Set is not null) result.Add((g.Key, PersonalRecordType.EstimatedOneRepMax, epley.Value, epley.Set));
                var volume = weighted.Select(s => (Set: s, Value: s.WeightKg!.Value * s.Reps!.Value)).OrderByDescending(x => x.Value).First();
                result.Add((g.Key, PersonalRecordType.BestSetVolume, volume.Value, volume.Set));
            }
            var bodyweight = g.Where(s => s.WeightKg is null or 0).OrderByDescending(s => s.Reps).FirstOrDefault();
            if (bodyweight is not null) result.Add((g.Key, PersonalRecordType.MostReps, bodyweight.Reps!.Value, bodyweight));
        }
        return result;
    }

    /// <summary>Updates the member's records from a session's sets (tracked, saved by the caller). Returns the improved ones.</summary>
    public static async Task<List<NewRecordResponse>> ApplyAsync(IAppDbContext db, ulong tenantId, ulong clientId, WorkoutLog log,
        IReadOnlyCollection<WorkoutSetLog> sets, IReadOnlyDictionary<ulong, string> exerciseNames)
    {
        var candidates = Candidates(sets);
        if (candidates.Count == 0) return [];
        var exerciseIds = candidates.Select(c => c.ExerciseId).Distinct().ToList();
        var existing = await db.PersonalRecords.Where(r => r.ClientId == clientId && exerciseIds.Contains(r.ExerciseId)).ToListAsync();
        var improved = new List<NewRecordResponse>();
        foreach (var (exerciseId, type, value, set) in candidates)
        {
            var current = existing.FirstOrDefault(r => r.ExerciseId == exerciseId && r.Type == type);
            if (current is not null && value <= current.Value) continue;
            if (current is not null)
                improved.Add(new NewRecordResponse
                {
                    ExerciseId = exerciseId, ExerciseName = exerciseNames.GetValueOrDefault(exerciseId), Type = RecordTypes.Name(type),
                    Value = value, PreviousValue = current.Value, Reps = set.Reps, WeightKg = set.WeightKg,
                });
            current ??= db.PersonalRecords.Add(new PersonalRecord { TenantId = tenantId, ClientId = clientId, ExerciseId = exerciseId, Type = type }).Entity;
            current.Value = value;
            current.Reps = set.Reps;
            current.WeightKg = set.WeightKg;
            current.WorkoutSetLogId = set.Id;
            current.WorkoutLogId = log.Id;
            current.AchievedAt = log.EndedAt ?? log.StartedAt;
        }
        return improved;
    }
}
