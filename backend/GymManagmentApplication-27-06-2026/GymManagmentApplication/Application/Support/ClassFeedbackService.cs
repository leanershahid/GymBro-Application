using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Support;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Support;

/// <summary>
/// Post-class feedback: after a class the member attended (booking marked Attended), Home asks
/// "How was {class}?" once per booking (answer or skip). Gym setting <see cref="SupportSettings.PostClassFeedback"/>.
/// Staff see averages per class type and per trainer.
/// </summary>
public class ClassFeedbackService(IAppDbContext db, ICurrentUser currentUser)
{
    /// <summary>Only classes from the last few days are asked about.</summary>
    public const int AskWithinDays = 3;

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    /// <summary>The most recent attended class without feedback, or null.</summary>
    public async Task<PendingClassFeedback?> PendingAsync()
    {
        var me = Me;
        var settings = await SupportSettingsStore.LoadAsync(db, TenantId);
        if (!settings.PostClassFeedback) return null;
        var now = DateTime.UtcNow;
        var since = now.AddDays(-AskWithinDays);
        var b = await db.ClassBookings.AsNoTracking()
            .Where(x => x.ClientId == me && x.Status == BookingStatus.Attended && x.Class.StartsAt >= since && x.Class.StartsAt <= now
                        && !db.ClassFeedbacks.Any(f => f.BookingId == x.Id))
            .OrderByDescending(x => x.Class.StartsAt)
            .Select(x => new
            {
                x.Id, x.ClassId, x.Class.Title, TypeName = x.Class.ClassType.Name, x.Class.StartsAt,
                Trainer = x.Class.Trainer == null ? null : x.Class.Trainer.DisplayName,
                TrainerFirst = x.Class.Trainer == null || x.Class.Trainer.User == null ? null : x.Class.Trainer.User.FirstName,
            })
            .FirstOrDefaultAsync();
        if (b is null) return null;
        return new PendingClassFeedback
        {
            BookingId = b.Id, ClassId = b.ClassId, ClassName = string.IsNullOrWhiteSpace(b.Title) ? b.TypeName : b.Title!,
            TrainerName = b.Trainer ?? b.TrainerFirst, StartsAt = b.StartsAt,
        };
    }

    /// <summary>Saves the rating (or a skip) — once per booking.</summary>
    public async Task SubmitAsync(ClassFeedbackBody body)
    {
        var me = Me;
        var tenantId = TenantId;
        var settings = await SupportSettingsStore.LoadAsync(db, tenantId);
        if (!settings.PostClassFeedback) throw RuleException.Unprocessable("Class feedback is turned off at your gym.");
        if (!body.Skip && body.Score is not (>= 1 and <= 5)) throw new ArgumentException("Pick 1 to 5 stars.");

        var booking = await db.ClassBookings.Include(x => x.Class)
            .FirstOrDefaultAsync(x => x.Id == body.BookingId && x.ClientId == me)
            ?? throw new KeyNotFoundException("Booking not found.");
        if (booking.Status != BookingStatus.Attended) throw RuleException.Unprocessable("You can rate a class once you've attended it.");
        if (await db.ClassFeedbacks.AnyAsync(f => f.BookingId == booking.Id))
            throw RuleException.Conflict("You've already told us about this class — thank you!");

        db.ClassFeedbacks.Add(new ClassFeedback
        {
            TenantId = tenantId, BookingId = booking.Id, UserId = me, ClassId = booking.ClassId,
            ClassTypeId = booking.Class.ClassTypeId, TrainerId = booking.Class.TrainerId,
            Score = body.Skip ? null : (byte)body.Score!.Value, Skipped = body.Skip,
            Comment = body.Skip ? null : SupportCommon.Clean(body.Comment, 1000),
        });
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException) { throw RuleException.Conflict("You've already told us about this class — thank you!"); }
    }

    /// <summary>Averages per class type and per trainer over the last <paramref name="days"/> days, recent comments, support satisfaction.</summary>
    public async Task<ClassFeedbackSummary> SummaryAsync(int days = 90)
    {
        days = Math.Clamp(days, 7, 365);
        var since = DateTime.UtcNow.AddDays(-days);
        var rated = db.ClassFeedbacks.AsNoTracking().Where(f => f.Score != null && f.CreatedAt >= since);
        var rows = await rated.Select(f => new { f.ClassTypeId, f.TrainerId, Score = (int)f.Score!.Value }).ToListAsync();

        var typeIds = rows.Select(r => r.ClassTypeId).Distinct().ToList();
        var typeNames = await db.ClassTypes.AsNoTracking().Where(t => typeIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, t => t.Name);
        var trainerIds = rows.Where(r => r.TrainerId != null).Select(r => r.TrainerId!.Value).Distinct().ToList();
        var trainerNames = (await db.TrainerProfiles.AsNoTracking().Where(t => trainerIds.Contains(t.Id))
                .Select(t => new { t.Id, t.DisplayName, First = t.User == null ? null : t.User.FirstName, Last = t.User == null ? null : t.User.LastName }).ToListAsync())
            .ToDictionary(t => t.Id, t => t.DisplayName ?? SupportCommon.Name(t.First, t.Last, "Trainer"));

        var comments = await rated.Where(f => f.Comment != null).OrderByDescending(f => f.CreatedAt).Take(20)
            .Select(f => new { f.ClassId, f.TrainerId, Score = (int)f.Score!.Value, f.Comment, f.CreatedAt }).ToListAsync();
        var classIds = comments.Select(c => c.ClassId).Distinct().ToList();
        var classNames = await db.GymClasses.AsNoTracking().Where(c => classIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Title, Type = c.ClassType.Name }).ToDictionaryAsync(c => c.Id, c => string.IsNullOrWhiteSpace(c.Title) ? c.Type : c.Title!);

        var support = await db.SupportRequests.AsNoTracking().Where(r => r.Rating != null && r.RatedAt >= since)
            .Select(r => (int)r.Rating!.Value).ToListAsync();

        static double Avg(IEnumerable<int> s) { var l = s.ToList(); return l.Count == 0 ? 0 : Math.Round(l.Average(), 2); }
        return new ClassFeedbackSummary
        {
            Days = days, Count = rows.Count, Average = Avg(rows.Select(r => r.Score)),
            ByClassType = rows.GroupBy(r => r.ClassTypeId)
                .Select(g => new FeedbackAverage { Id = g.Key, Name = typeNames.GetValueOrDefault(g.Key, "Class"), Average = Avg(g.Select(x => x.Score)), Count = g.Count() })
                .OrderByDescending(a => a.Count).ToList(),
            ByTrainer = rows.Where(r => r.TrainerId != null).GroupBy(r => r.TrainerId!.Value)
                .Select(g => new FeedbackAverage { Id = g.Key, Name = trainerNames.GetValueOrDefault(g.Key, "Trainer"), Average = Avg(g.Select(x => x.Score)), Count = g.Count() })
                .OrderByDescending(a => a.Count).ToList(),
            RecentComments = comments.Select(c => new FeedbackComment
            {
                ClassName = classNames.GetValueOrDefault(c.ClassId, "Class"),
                TrainerName = c.TrainerId is { } t ? trainerNames.GetValueOrDefault(t) : null,
                Score = c.Score, Comment = c.Comment!, At = c.CreatedAt,
            }).ToList(),
            SupportAverage = Avg(support), SupportRatings = support.Count,
        };
    }
}
