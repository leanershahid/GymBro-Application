using System.Globalization;

namespace GymManagmentApplication.Application.Operations;

/// <summary>A local opening interval (in the branch time zone). Closes ≤ Opens means it runs past midnight.</summary>
public readonly record struct LocalInterval(TimeOnly Opens, TimeOnly Closes)
{
    public bool IsOvernight => Closes <= Opens;
    public override string ToString() => $"{Opens:HH\\:mm}-{Closes:HH\\:mm}";
}

/// <summary>A date whose hours replace the regular week's.</summary>
public sealed record HoursExceptionDay(DateOnly Date, bool IsClosed, IReadOnlyList<LocalInterval> Intervals, string? Note);

/// <summary>One concrete opening, as UTC instants.</summary>
public readonly record struct OpenSpan(DateTime StartUtc, DateTime EndUtc);

/// <summary>"Open now?" and the human label the apps show.</summary>
public sealed record OpenStatus(
    bool IsOpen,
    /// <summary>"open", "closing_soon", "opening_soon", "closed", "unknown" (no hours set).</summary>
    string State,
    string Label,
    DateTime? ClosesAtUtc,
    DateTime? OpensAtUtc,
    string? Note);

/// <summary>One of the next days, for the week list.</summary>
public sealed record HoursDay(DateOnly Date, string DayLabel, bool IsClosed, List<string> Intervals, string? Note, bool IsException, bool IsToday);

/// <summary>
/// Pure opening-hours maths (no database), so it is unit-tested directly. All inputs are in the
/// branch's local time; instants are compared in UTC, so DST changes are handled by the zone:
/// a local time skipped by a spring-forward is moved to the first valid minute after the gap,
/// and an ambiguous fall-back time resolves to its first (daylight) occurrence.
/// </summary>
public sealed class OpeningHoursCalculator
{
    /// <summary>"Closing soon" / "opening soon" window.</summary>
    public static readonly TimeSpan SoonWindow = TimeSpan.FromMinutes(60);
    private const int LookAheadDays = 14;

    private readonly TimeZoneInfo zone;
    private readonly ILookup<DayOfWeek, LocalInterval> weekly;
    private readonly Dictionary<DateOnly, HoursExceptionDay> exceptions;

    public OpeningHoursCalculator(TimeZoneInfo zone, IEnumerable<(DayOfWeek Day, LocalInterval Interval)> weekly, IEnumerable<HoursExceptionDay>? exceptions = null)
    {
        this.zone = zone;
        this.weekly = weekly.ToLookup(w => w.Day, w => w.Interval);
        this.exceptions = (exceptions ?? []).GroupBy(e => e.Date).ToDictionary(g => g.Key, g => g.Last());
        HasAnyHours = this.weekly.Any() || this.exceptions.Values.Any(e => !e.IsClosed && e.Intervals.Count > 0);
    }

    /// <summary>False when the branch has no hours at all (then it is never reported closed and never blocks check-in).</summary>
    public bool HasAnyHours { get; }

    /// <summary>The intervals that start on a local date (exception, else the regular weekday).</summary>
    public IReadOnlyList<LocalInterval> IntervalsFor(DateOnly date, out HoursExceptionDay? exception)
    {
        if (exceptions.TryGetValue(date, out var ex))
        {
            exception = ex;
            return ex.IsClosed ? [] : ex.Intervals.OrderBy(i => i.Opens).ToList();
        }
        exception = null;
        return weekly[date.DayOfWeek].OrderBy(i => i.Opens).ToList();
    }

    /// <summary>Concrete openings of the intervals starting on <paramref name="date"/>.</summary>
    public IEnumerable<OpenSpan> SpansFor(DateOnly date)
    {
        foreach (var i in IntervalsFor(date, out _))
        {
            var start = ToUtc(date, i.Opens);
            var end = ToUtc(i.IsOvernight ? date.AddDays(1) : date, i.Closes);
            if (end > start) yield return new OpenSpan(start, end);
        }
    }

    /// <summary>Openings from the day before <paramref name="from"/> (overnight carry-over) for <paramref name="days"/> days, merged when they touch.</summary>
    public List<OpenSpan> MergedSpans(DateOnly from, int days)
    {
        var spans = new List<OpenSpan>();
        for (var d = from.AddDays(-1); d <= from.AddDays(days); d = d.AddDays(1)) spans.AddRange(SpansFor(d));
        spans.Sort((a, b) => a.StartUtc.CompareTo(b.StartUtc));
        var merged = new List<OpenSpan>();
        foreach (var s in spans)
        {
            if (merged.Count > 0 && s.StartUtc <= merged[^1].EndUtc)
            {
                var last = merged[^1];
                merged[^1] = last with { EndUtc = s.EndUtc > last.EndUtc ? s.EndUtc : last.EndUtc };
            }
            else merged.Add(s);
        }
        return merged;
    }

    public bool IsOpenAt(DateTime utc)
    {
        if (!HasAnyHours) return true;
        var local = LocalDate(utc);
        return SpansFor(local.AddDays(-1)).Concat(SpansFor(local)).Any(s => s.StartUtc <= utc && utc < s.EndUtc);
    }

    public OpenStatus StatusAt(DateTime utc)
    {
        if (!HasAnyHours) return new OpenStatus(false, "unknown", "Hours not set", null, null, null);
        var today = LocalDate(utc);
        IntervalsFor(today, out var todayException);
        var note = todayException?.Note;
        var spans = MergedSpans(today, LookAheadDays);

        var current = spans.FirstOrDefault(s => s.StartUtc <= utc && utc < s.EndUtc);
        if (current != default)
        {
            if (current.EndUtc - utc >= TimeSpan.FromHours(24))
                return new OpenStatus(true, "open", "Open 24 hours", current.EndUtc, null, note);
            var soon = current.EndUtc - utc <= SoonWindow;
            return new OpenStatus(true, soon ? "closing_soon" : "open",
                $"{(soon ? "Closing soon" : "Open")} · closes {FormatTime(current.EndUtc)}{DaySuffix(current.EndUtc, today, onlyIfBeyondTomorrow: true)}",
                current.EndUtc, null, note);
        }

        var next = spans.FirstOrDefault(s => s.StartUtc > utc);
        if (next == default)
            return new OpenStatus(false, "closed", "Closed", null, null, note);
        var opensSoon = next.StartUtc - utc <= SoonWindow;
        return new OpenStatus(false, opensSoon ? "opening_soon" : "closed",
            $"Closed · opens {FormatTime(next.StartUtc)}{DaySuffix(next.StartUtc, today, onlyIfBeyondTomorrow: false)}",
            null, next.StartUtc, note);
    }

    /// <summary>The next <paramref name="count"/> local days starting today, for the hours list.</summary>
    public List<HoursDay> NextDays(DateTime utc, int count = 7)
    {
        var today = LocalDate(utc);
        var list = new List<HoursDay>(count);
        for (var i = 0; i < count; i++)
        {
            var d = today.AddDays(i);
            var intervals = IntervalsFor(d, out var ex);
            var label = i == 0 ? "Today" : i == 1 ? "Tomorrow" : d.ToString("ddd", CultureInfo.InvariantCulture);
            list.Add(new HoursDay(d, label, intervals.Count == 0, intervals.Select(FormatInterval).ToList(), ex?.Note, ex is not null, i == 0));
        }
        return list;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone));

    private DateTime Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone);

    /// <summary>Local wall time → UTC; times inside a DST gap move forward past the gap.</summary>
    public DateTime ToUtc(DateOnly date, TimeOnly time)
    {
        var local = DateTime.SpecifyKind(date.ToDateTime(time), DateTimeKind.Unspecified);
        var guard = 0;
        while (zone.IsInvalidTime(local) && guard++ < 180) local = local.AddMinutes(1);
        if (zone.IsAmbiguousTime(local))
        {
            // First occurrence = the larger (daylight) offset.
            var offset = zone.GetAmbiguousTimeOffsets(local).Max();
            return DateTime.SpecifyKind(local - offset, DateTimeKind.Utc);
        }
        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }

    /// <summary>"10pm", "6:30am", "12pm".</summary>
    public string FormatTime(DateTime utc) => FormatClock(TimeOnly.FromDateTime(Local(utc)));

    public static string FormatClock(TimeOnly t)
    {
        var h = t.Hour % 12 == 0 ? 12 : t.Hour % 12;
        var suffix = t.Hour < 12 ? "am" : "pm";
        return t.Minute == 0 ? $"{h}{suffix}" : $"{h}:{t.Minute:00}{suffix}";
    }

    public static string FormatInterval(LocalInterval i) =>
        i.Opens == i.Closes && i.Opens == TimeOnly.MinValue ? "Open 24 hours" : $"{FormatClock(i.Opens)} – {FormatClock(i.Closes)}";

    private string DaySuffix(DateTime utc, DateOnly today, bool onlyIfBeyondTomorrow)
    {
        var d = LocalDate(utc);
        if (d == today) return "";
        if (d == today.AddDays(1))
        {
            if (onlyIfBeyondTomorrow) return ""; // "closes 2am" after midnight is clear enough
            return " tomorrow";
        }
        return " " + d.ToString("ddd", CultureInfo.InvariantCulture);
    }

    // ── Parsing ("06:00-12:00,16:00-22:00") ─────────────────────────────────

    public static List<LocalInterval> ParseIntervals(string? text)
    {
        var list = new List<LocalInterval>();
        if (string.IsNullOrWhiteSpace(text)) return list;
        foreach (var part in text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var bits = part.Split('-', StringSplitOptions.TrimEntries);
            if (bits.Length == 2 && TryParseTime(bits[0], out var o) && TryParseTime(bits[1], out var c))
                list.Add(new LocalInterval(o, c));
        }
        return list;
    }

    public static string FormatIntervals(IEnumerable<LocalInterval> intervals) => string.Join(",", intervals.Select(i => i.ToString()));

    /// <summary>"06:00", "6:00", "24:00" (= midnight at the end of the day).</summary>
    public static bool TryParseTime(string? s, out TimeOnly time)
    {
        time = default;
        if (string.IsNullOrWhiteSpace(s)) return false;
        s = s.Trim();
        if (s is "24:00" or "24:00:00") { time = TimeOnly.MinValue; return true; }
        return TimeOnly.TryParseExact(s, ["HH:mm", "H:mm", "HH:mm:ss"], CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
    }
}
