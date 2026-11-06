using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Health.Requests;
using GymManagmentApplication.Application.Health.Responses;
using GymManagmentApplication.Domain.Entities.Health;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Health.Services;

/// <summary>
/// Body metrics (weight, body fat, sleep…) over time and the progress journal with photos
/// (ARCH-077: moved here from Engagement's EngagementService).
/// </summary>
public class ProgressService(IAppDbContext db, ICurrentUser currentUser, IFileStorage storage)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

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

    public async Task<JournalEntryResponse> AddJournalAsync(string? title, string? content, DateOnly? date, FileUpload? photo)
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
