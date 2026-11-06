using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Support;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Support;

/// <summary>The gym's help-desk settings (TenantSettings key <c>support</c>).</summary>
public class SupportSettings
{
    /// <summary>Target for the first reply the member sees, in hours.</summary>
    public int FirstResponseHours { get; set; } = 24;
    /// <summary>Target for resolving a request, in hours (restarts when the member reopens it).</summary>
    public int ResolutionHours { get; set; } = 72;
    /// <summary>Ask members "How was {class}?" after an attended class.</summary>
    public bool PostClassFeedback { get; set; } = true;
    /// <summary>Show the "Contact us" form (off = FAQ only, plus the gym's contact details).</summary>
    public bool RequestsEnabled { get; set; } = true;

    public void Validate()
    {
        if (FirstResponseHours is < 1 or > 720) throw new ArgumentException("First response target must be between 1 and 720 hours.");
        if (ResolutionHours is < 1 or > 2160) throw new ArgumentException("Resolution target must be between 1 and 2160 hours.");
        if (ResolutionHours < FirstResponseHours) throw new ArgumentException("Resolution target can't be shorter than the first response target.");
    }
}

public static class SupportSettingsStore
{
    public const string SettingKey = "support";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<SupportSettings> LoadAsync(IAppDbContext db, ulong tenantId, CancellationToken ct = default)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey, ct);
        return row?.Value is null ? new SupportSettings() : row.Value.Deserialize<SupportSettings>(Json) ?? new SupportSettings();
    }

    public static async Task<SupportSettings> SaveAsync(IAppDbContext db, ulong tenantId, SupportSettings settings)
    {
        settings.Validate();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else { row.Value = value; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync();
        return settings;
    }
}

/// <summary>SLA state of one target: <c>met</c>, <c>missed</c> (met late), <c>overdue</c>, <c>due_soon</c>, <c>on_track</c>, or <c>none</c> (not applicable).</summary>
public sealed record SlaTarget(string State, DateTime DueAt);

public sealed record SlaInfo(SlaTarget FirstResponse, SlaTarget Resolution)
{
    /// <summary>Something is overdue right now (drives the red highlight, badge and digest).</summary>
    public bool Overdue => FirstResponse.State == SlaStates.Overdue || Resolution.State == SlaStates.Overdue;
    public bool DueSoon => !Overdue && (FirstResponse.State == SlaStates.DueSoon || Resolution.State == SlaStates.DueSoon);
}

public static class SlaStates
{
    public const string Met = "met";
    public const string Missed = "missed";
    public const string Overdue = "overdue";
    public const string DueSoon = "due_soon";
    public const string OnTrack = "on_track";
    public const string None = "none";
}

/// <summary>
/// SLA rules (pure, unit-tested):
/// <list type="bullet">
/// <item>First response is due <see cref="SupportSettings.FirstResponseHours"/> after the request
/// was raised; it is met by the first staff reply the member can see (internal notes don't count).</item>
/// <item>Resolution is due <see cref="SupportSettings.ResolutionHours"/> after it was raised, or
/// after the last reopen. The clock only runs while the request is <c>open</c>: while it is
/// "waiting on you" the gym is waiting for the member, so it never shows as overdue.</item>
/// <item>"Due soon" = the last 20% of the target (at least one hour).</item>
/// </list>
/// </summary>
public static class SupportSla
{
    public static SlaInfo Evaluate(SupportRequest r, SupportSettings s, DateTime now)
    {
        var firstDue = r.CreatedAt.AddHours(s.FirstResponseHours);
        var resolveDue = (r.ReopenedAt ?? r.CreatedAt).AddHours(s.ResolutionHours);
        var active = SupportStatuses.IsActive(r.Status);

        SlaTarget first;
        if (r.FirstResponseAt is { } at) first = new(at <= firstDue ? SlaStates.Met : SlaStates.Missed, firstDue);
        else if (!active) first = new(SlaStates.None, firstDue);
        else first = new(Running(now, firstDue, s.FirstResponseHours), firstDue);

        SlaTarget resolution;
        if (r.ResolvedAt is { } done && !active) resolution = new(done <= resolveDue ? SlaStates.Met : SlaStates.Missed, resolveDue);
        else if (r.Status == SupportStatuses.Open) resolution = new(Running(now, resolveDue, s.ResolutionHours), resolveDue);
        else resolution = new(active ? SlaStates.OnTrack : SlaStates.None, resolveDue);

        return new SlaInfo(first, resolution);
    }

    private static string Running(DateTime now, DateTime due, int targetHours)
    {
        if (now > due) return SlaStates.Overdue;
        var soon = TimeSpan.FromHours(Math.Max(1, targetHours * 0.2));
        return due - now <= soon ? SlaStates.DueSoon : SlaStates.OnTrack;
    }

    /// <summary>
    /// The same "overdue now" rule as a query predicate input: requests created before
    /// <c>firstCutoff</c> with no response, or open requests whose clock started before <c>resolveCutoff</c>.
    /// </summary>
    public static (DateTime FirstCutoff, DateTime ResolveCutoff) Cutoffs(SupportSettings s, DateTime now) =>
        (now.AddHours(-s.FirstResponseHours), now.AddHours(-s.ResolutionHours));

    public static IQueryable<SupportRequest> WhereOverdue(this IQueryable<SupportRequest> q, SupportSettings s, DateTime now)
    {
        var (firstCutoff, resolveCutoff) = Cutoffs(s, now);
        return q.Where(r =>
            ((r.Status == SupportStatuses.Open || r.Status == SupportStatuses.Waiting) && r.FirstResponseAt == null && r.CreatedAt < firstCutoff) ||
            (r.Status == SupportStatuses.Open && (r.ReopenedAt ?? r.CreatedAt) < resolveCutoff));
    }
}
