using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Gamification;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Engagement;

// ── DTOs ────────────────────────────────────────────────────────────────────
public class ChallengeProgressRequest
{
    /// <summary>Adds to the member's progress (e.g. km run today). Use Set to overwrite instead.</summary>
    public decimal Value { get; set; }
    public bool Set { get; set; }
}

public class UpdateChallengeRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Metric { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}

public class LeaderboardEntry
{
    public int Rank { get; set; }
    public ulong UserId { get; set; }
    public string Name { get; set; } = default!;
    public decimal Progress { get; set; }
    public double ProgressPct { get; set; }
    public bool IsMe { get; set; }
}

public class ChallengeDetailResponse
{
    public ulong Id { get; set; }
    public string Title { get; set; } = default!;
    public string? Description { get; set; }
    public string? Metric { get; set; }
    public decimal? TargetValue { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string Status { get; set; } = default!;
    public int ParticipantCount { get; set; }
    public bool IsJoined { get; set; }
    public decimal MyProgress { get; set; }
    public int? MyRank { get; set; }
    public List<LeaderboardEntry> Leaderboard { get; set; } = [];
}

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

/// <summary>
/// Member engagement: joining challenges, logging progress and leaderboards; body metrics
/// (weight, body fat, sleep…) over time; and a progress journal with photos.
/// </summary>
public class EngagementService(AppDbContext db, ICurrentUser currentUser, IFileStorage storage)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    // ── Challenges ──────────────────────────────────────────────────────────

    public async Task<ChallengeDetailResponse> GetChallengeAsync(ulong id)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (currentUser.IsClient() && c.Status == ChallengeStatus.Draft) throw new KeyNotFoundException("Challenge not found.");
        var parts = await db.ChallengeParticipants.Include(p => p.User).Where(p => p.ChallengeId == id)
            .OrderByDescending(p => p.Progress).ThenBy(p => p.JoinedAt).ToListAsync();
        var me = currentUser.UserId;
        var board = parts.Select((p, i) => new LeaderboardEntry
        {
            Rank = i + 1, UserId = p.UserId, Name = $"{p.User.FirstName} {(p.User.LastName ?? "").FirstOrDefault()}".Trim().TrimEnd(' '),
            Progress = p.Progress, ProgressPct = Pct(p.Progress, c.TargetValue), IsMe = p.UserId == me,
        }).ToList();
        var mine = board.FirstOrDefault(b => b.IsMe);
        return new ChallengeDetailResponse
        {
            Id = c.Id, Title = c.Title, Description = c.Description, Metric = c.Metric, TargetValue = c.TargetValue,
            StartsAt = c.StartsAt, EndsAt = c.EndsAt, Status = c.Status.ToString(), ParticipantCount = parts.Count,
            IsJoined = mine is not null, MyProgress = mine?.Progress ?? 0, MyRank = mine?.Rank,
            // Top 20, plus the caller's own row if they're further down.
            Leaderboard = board.Take(20).Concat(mine is { Rank: > 20 } ? [mine] : []).ToList(),
        };
    }

    public async Task<ChallengeDetailResponse> JoinAsync(ulong id)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (c.Status != ChallengeStatus.Active || c.EndsAt < DateTime.UtcNow) throw new ArgumentException("This challenge isn't open for joining.");
        if (!await db.ChallengeParticipants.AnyAsync(p => p.ChallengeId == id && p.UserId == Me))
        {
            db.ChallengeParticipants.Add(new ChallengeParticipant { TenantId = c.TenantId, ChallengeId = id, UserId = Me });
            await db.SaveChangesAsync();
        }
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> LeaveAsync(ulong id)
    {
        await db.ChallengeParticipants.Where(p => p.ChallengeId == id && p.UserId == Me).ExecuteDeleteAsync();
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> LogProgressAsync(ulong id, ChallengeProgressRequest r)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        var now = DateTime.UtcNow;
        if (c.Status != ChallengeStatus.Active || now < c.StartsAt || now > c.EndsAt)
            throw new ArgumentException("Progress can only be logged while the challenge is running.");
        if (r.Value < 0 || (!r.Set && r.Value == 0)) throw new ArgumentException("Enter a positive amount.");
        var p = await db.ChallengeParticipants.FirstOrDefaultAsync(x => x.ChallengeId == id && x.UserId == Me)
                ?? throw new ArgumentException("Join the challenge first.");
        p.Progress = r.Set ? r.Value : p.Progress + r.Value;
        await db.SaveChangesAsync();
        await RerankAsync(id);
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> UpdateChallengeAsync(ulong id, UpdateChallengeRequest r)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (r.Title is not null)
        {
            if (string.IsNullOrWhiteSpace(r.Title)) throw new ArgumentException("Give the challenge a title.");
            c.Title = r.Title.Trim();
        }
        if (r.Description is not null) c.Description = r.Description.Trim();
        if (r.Metric is not null) c.Metric = r.Metric.Trim();
        if (r.TargetValue is not null) c.TargetValue = r.TargetValue <= 0 ? null : r.TargetValue;
        if (r.StartsAt is { } s) c.StartsAt = s;
        if (r.EndsAt is { } e) c.EndsAt = e;
        if (c.EndsAt <= c.StartsAt) throw new ArgumentException("The end must be after the start.");
        await db.SaveChangesAsync();
        return await GetChallengeAsync(id);
    }

    private async Task RerankAsync(ulong challengeId)
    {
        var parts = await db.ChallengeParticipants.Where(p => p.ChallengeId == challengeId)
            .OrderByDescending(p => p.Progress).ThenBy(p => p.JoinedAt).ToListAsync();
        for (var i = 0; i < parts.Count; i++) parts[i].Rank = (ushort)(i + 1);
        await db.SaveChangesAsync();
    }

    private static double Pct(decimal progress, decimal? target) =>
        target is > 0 ? Math.Round(Math.Clamp((double)(progress / target.Value * 100), 0, 100), 1) : 0;

    // ── Body metrics ────────────────────────────────────────────────────────

    public async Task<List<BodyMetricResponse>> GetMetricsAsync(ulong? clientId, int days)
    {
        var who = await ResolveClientAsync(clientId);
        var since = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 730)));
        var rows = await db.HealthMetrics.Where(m => m.ClientId == who && m.MetricDate >= since)
            .OrderBy(m => m.MetricDate).ToListAsync();
        return rows.Select(Map).ToList();
    }

    /// <summary>One row per day: logging again the same day updates it. BMI is derived when height is known.</summary>
    public async Task<BodyMetricResponse> LogMetricAsync(BodyMetricRequest r)
    {
        if (r.WeightKg is < 20 or > 400) throw new ArgumentException("Weight must be between 20 and 400 kg.");
        if (r.BodyFatPct is < 2 or > 75) throw new ArgumentException("Body fat must be between 2 and 75%.");
        if (r.SleepHours is < 0 or > 24) throw new ArgumentException("Sleep must be between 0 and 24 hours.");
        if (r.Mood is < 1 or > 5) throw new ArgumentException("Mood is 1 to 5.");
        var date = r.Date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (date > DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1))) throw new ArgumentException("That date is in the future.");

        var tenantId = currentUser.ResolveTenantId();
        var m = await db.HealthMetrics.FirstOrDefaultAsync(x => x.ClientId == Me && x.MetricDate == date);
        m ??= db.HealthMetrics.Add(new HealthMetric { TenantId = tenantId, ClientId = Me, MetricDate = date, Source = MetricSource.App }).Entity;
        m.WeightKg = r.WeightKg ?? m.WeightKg;
        m.BodyFatPct = r.BodyFatPct ?? m.BodyFatPct;
        m.RestingHr = r.RestingHr ?? m.RestingHr;
        m.SleepHours = r.SleepHours ?? m.SleepHours;
        m.HydrationMl = r.HydrationMl ?? m.HydrationMl;
        m.Steps = r.Steps ?? m.Steps;
        m.Mood = r.Mood ?? m.Mood;
        m.Notes = r.Notes ?? m.Notes;

        var heightCm = await db.ClientProfiles.Where(p => p.UserId == Me).Select(p => p.HeightCm).FirstOrDefaultAsync();
        if (m.WeightKg is { } w && heightCm is > 0)
            m.Bmi = Math.Round(w / (decimal)Math.Pow((double)heightCm.Value / 100.0, 2), 1);

        await db.SaveChangesAsync();
        return Map(m);
    }

    private static BodyMetricResponse Map(HealthMetric m) => new()
    {
        Date = m.MetricDate, WeightKg = m.WeightKg, BodyFatPct = m.BodyFatPct, Bmi = m.Bmi, RestingHr = m.RestingHr,
        SleepHours = m.SleepHours, HydrationMl = m.HydrationMl, Steps = m.Steps, Mood = m.Mood, Notes = m.Notes,
    };

    // ── Progress journal (photos) ───────────────────────────────────────────

    public async Task<List<JournalEntryResponse>> GetJournalAsync(ulong? clientId)
    {
        var who = await ResolveClientAsync(clientId);
        var rows = await db.TransformationJournals.Where(j => j.ClientId == who)
            .OrderByDescending(j => j.JournalDate).ThenByDescending(j => j.CreatedAt).Take(200).ToListAsync();
        return rows.Select(Map).ToList();
    }

    public async Task<JournalEntryResponse> AddJournalAsync(string? title, string? content, DateOnly? date, IFormFile? photo)
    {
        if (string.IsNullOrWhiteSpace(content) && photo is null) throw new ArgumentException("Add a note or a photo.");
        var tenantId = currentUser.ResolveTenantId();
        var photos = new List<string>();
        if (photo is not null)
            photos.Add(await storage.SaveAsync(photo, $"tenants/{tenantId}/members/{Me}/progress", FileKind.Image));
        var entry = new TransformationJournal
        {
            TenantId = tenantId, ClientId = Me, JournalDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Title = title?.Trim(), Content = content?.Trim(),
            Photos = photos.Count == 0 ? null : JsonSerializer.SerializeToDocument(photos),
        };
        db.TransformationJournals.Add(entry);
        await db.SaveChangesAsync();
        return Map(entry);
    }

    public async Task<bool> DeleteJournalAsync(ulong id)
    {
        var e = await db.TransformationJournals.FirstOrDefaultAsync(j => j.Id == id && j.ClientId == Me);
        if (e is null) return false;
        foreach (var url in Map(e).Photos) await storage.DeleteAsync(url);
        db.TransformationJournals.Remove(e);
        await db.SaveChangesAsync();
        return true;
    }

    private static JournalEntryResponse Map(TransformationJournal j)
    {
        var photos = new List<string>();
        if (j.Photos?.RootElement is { ValueKind: JsonValueKind.Array } arr)
            photos.AddRange(arr.EnumerateArray().Where(p => p.ValueKind == JsonValueKind.String).Select(p => p.GetString()!));
        return new JournalEntryResponse { Id = j.Id, Date = j.JournalDate, Title = j.Title, Content = j.Content, Photos = photos, CreatedAt = j.CreatedAt };
    }

    /// <summary>Members see their own data; trainers their assigned clients; staff anyone in the gym.</summary>
    private async Task<ulong> ResolveClientAsync(ulong? clientId)
    {
        if (currentUser.IsClient() || clientId is null) return Me;
        await db.EnsureCanActOnAllAsync(currentUser, [clientId.Value]);
        return clientId.Value;
    }
}
