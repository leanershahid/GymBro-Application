using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Operations;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Entities.Operations;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Tests;

/// <summary>Opening hours maths (pure): intervals, overnight, exceptions, time zones and DST.</summary>
public class OpeningHoursCalculatorTests
{
    private static (DayOfWeek, LocalInterval) W(DayOfWeek d, string opens, string closes)
    {
        OpeningHoursCalculator.TryParseTime(opens, out var o);
        OpeningHoursCalculator.TryParseTime(closes, out var c);
        return (d, new LocalInterval(o, c));
    }

    private static DateTime Utc(int y, int m, int d, int h, int min = 0) => new(y, m, d, h, min, 0, DateTimeKind.Utc);

    // 2026-03-02 is a Monday.
    private static readonly DateOnly Monday = new(2026, 3, 2);

    [Fact]
    public void Several_intervals_a_day_report_open_closed_and_the_next_opening()
    {
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc,
            [W(DayOfWeek.Monday, "06:00", "12:00"), W(DayOfWeek.Monday, "16:00", "22:00"), W(DayOfWeek.Tuesday, "06:00", "22:00")]);

        var morning = calc.StatusAt(Utc(2026, 3, 2, 9));
        Assert.True(morning.IsOpen);
        Assert.Equal("Open · closes 12pm", morning.Label);

        var lunch = calc.StatusAt(Utc(2026, 3, 2, 13));
        Assert.False(lunch.IsOpen);
        Assert.Equal("Closed · opens 4pm", lunch.Label);

        var night = calc.StatusAt(Utc(2026, 3, 2, 23));
        Assert.Equal("Closed · opens 6am tomorrow", night.Label);

        var soon = calc.StatusAt(Utc(2026, 3, 2, 21, 30));
        Assert.Equal("closing_soon", soon.State);
        Assert.Equal("Closing soon · closes 10pm", soon.Label);
    }

    [Fact]
    public void Next_opening_days_away_names_the_weekday()
    {
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc, [W(DayOfWeek.Monday, "06:00", "22:00")]);
        // Wednesday evening → next Monday.
        Assert.Equal("Closed · opens 6am Mon", calc.StatusAt(Utc(2026, 3, 4, 20)).Label);
    }

    [Fact]
    public void Overnight_hours_run_past_midnight_into_the_next_day()
    {
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc, [W(DayOfWeek.Friday, "18:00", "02:00")]);
        // Friday 2026-03-06; Saturday 01:30 is still Friday's opening.
        Assert.True(calc.IsOpenAt(Utc(2026, 3, 7, 1, 30)));
        Assert.False(calc.IsOpenAt(Utc(2026, 3, 7, 2, 30)));
        var s = calc.StatusAt(Utc(2026, 3, 6, 23));
        Assert.True(s.IsOpen);
        Assert.Equal("Open · closes 2am", s.Label);
        Assert.Equal(Utc(2026, 3, 7, 2), s.ClosesAtUtc);
    }

    [Fact]
    public void Touching_intervals_merge_and_all_day_every_day_is_open_24_hours()
    {
        var all = Enum.GetValues<DayOfWeek>().Select(d => W(d, "00:00", "00:00")).ToList();
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc, all);
        Assert.Equal("Open 24 hours", calc.StatusAt(Utc(2026, 3, 3, 3)).Label);

        // Monday 18:00–24:00 + Tuesday 00:00–02:00 = one opening closing at 2am.
        var split = new OpeningHoursCalculator(TimeZoneInfo.Utc, [W(DayOfWeek.Monday, "18:00", "24:00"), W(DayOfWeek.Tuesday, "00:00", "02:00")]);
        Assert.Equal(Utc(2026, 3, 3, 2), split.StatusAt(Utc(2026, 3, 2, 20)).ClosesAtUtc);
    }

    [Fact]
    public void Holiday_closures_and_special_hours_replace_the_regular_day()
    {
        var weekly = Enum.GetValues<DayOfWeek>().Select(d => W(d, "06:00", "22:00")).ToList();
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc, weekly,
        [
            new HoursExceptionDay(Monday, true, [], "Holi — closed"),
            new HoursExceptionDay(Monday.AddDays(1), false, [new LocalInterval(new TimeOnly(10, 0), new TimeOnly(14, 0))], "Short day"),
        ]);

        var holiday = calc.StatusAt(Utc(2026, 3, 2, 12));
        Assert.False(holiday.IsOpen);
        Assert.Equal("Closed · opens 10am tomorrow", holiday.Label);
        Assert.Equal("Holi — closed", holiday.Note);

        Assert.False(calc.IsOpenAt(Utc(2026, 3, 3, 8)));  // regular 6am opening replaced
        Assert.True(calc.IsOpenAt(Utc(2026, 3, 3, 11)));
        Assert.Equal("Open · closes 2pm", calc.StatusAt(Utc(2026, 3, 3, 11)).Label);

        var days = calc.NextDays(Utc(2026, 3, 2, 12));
        Assert.Equal(7, days.Count);
        Assert.Equal("Today", days[0].DayLabel);
        Assert.True(days[0].IsClosed);
        Assert.True(days[0].IsException);
        Assert.Equal("Tomorrow", days[1].DayLabel);
        Assert.Equal(["10am – 2pm"], days[1].Intervals);
        Assert.Equal("Wed", days[2].DayLabel);
        Assert.Equal(["6am – 10pm"], days[2].Intervals);
    }

    [Fact]
    public void Hours_are_in_the_branch_time_zone()
    {
        var india = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        var calc = new OpeningHoursCalculator(india, Enum.GetValues<DayOfWeek>().Select(d => W(d, "06:00", "22:00")));
        // 15:00Z = 20:30 IST → open, closes 10pm local (16:30Z).
        var s = calc.StatusAt(Utc(2026, 11, 5, 15));
        Assert.Equal("Open · closes 10pm", s.Label);
        Assert.Equal(Utc(2026, 11, 5, 16, 30), s.ClosesAtUtc);
        // 17:00Z = 22:30 IST → closed until 6am IST (00:30Z next day).
        Assert.Equal("Closed · opens 6am tomorrow", calc.StatusAt(Utc(2026, 11, 5, 17)).Label);
    }

    [Fact]
    public void Daylight_saving_changes_keep_local_opening_times()
    {
        var ny = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
        var calc = new OpeningHoursCalculator(ny, Enum.GetValues<DayOfWeek>().Select(d => W(d, "06:00", "22:00")));
        // Saturday before the spring change (EST, UTC-5) and the Monday after (EDT, UTC-4): 6am local both days.
        Assert.Equal(Utc(2026, 3, 7, 11), calc.ToUtc(new DateOnly(2026, 3, 7), new TimeOnly(6, 0)));
        Assert.Equal(Utc(2026, 3, 9, 10), calc.ToUtc(new DateOnly(2026, 3, 9), new TimeOnly(6, 0)));
        Assert.True(calc.IsOpenAt(Utc(2026, 3, 9, 10, 30)));
        Assert.False(calc.IsOpenAt(Utc(2026, 3, 7, 10, 30))); // 5:30am EST

        // 02:30 doesn't exist on 2026-03-08 (clocks jump 2→3am): moved to 3am EDT = 07:00Z.
        Assert.Equal(Utc(2026, 3, 8, 7), calc.ToUtc(new DateOnly(2026, 3, 8), new TimeOnly(2, 30)));
        // 01:30 happens twice on 2026-11-01: the first (EDT) occurrence = 05:30Z.
        Assert.Equal(Utc(2026, 11, 1, 5, 30), calc.ToUtc(new DateOnly(2026, 11, 1), new TimeOnly(1, 30)));

        // An overnight interval across the fall-back night lasts the extra hour: Sat 22:00 → Sun 02:00 EST.
        var overnight = new OpeningHoursCalculator(ny, [W(DayOfWeek.Saturday, "22:00", "02:00")]);
        var span = overnight.SpansFor(new DateOnly(2026, 10, 31)).Single();
        Assert.Equal(TimeSpan.FromHours(5), span.EndUtc - span.StartUtc);
    }

    [Fact]
    public void No_hours_means_unknown_and_never_closed()
    {
        var calc = new OpeningHoursCalculator(TimeZoneInfo.Utc, []);
        Assert.False(calc.HasAnyHours);
        Assert.True(calc.IsOpenAt(Utc(2026, 3, 2, 3)));
        Assert.Equal("unknown", calc.StatusAt(Utc(2026, 3, 2, 3)).State);
    }

    [Fact]
    public void Interval_validation_rejects_overlaps_and_bad_times()
    {
        Assert.Throws<ArgumentException>(() => OpeningHoursService.ValidateIntervals(
            [new IntervalDto { Opens = "06:00", Closes = "12:00" }, new IntervalDto { Opens = "11:00", Closes = "14:00" }], "Monday"));
        Assert.Throws<ArgumentException>(() => OpeningHoursService.ValidateIntervals([new IntervalDto { Opens = "6am", Closes = "12:00" }], "Monday"));
        Assert.Throws<ArgumentException>(() => OpeningHoursService.ValidateIntervals(
            [new IntervalDto { Opens = "20:00", Closes = "02:00" }, new IntervalDto { Opens = "21:00", Closes = "23:00" }], "Monday"));
        var ok = OpeningHoursService.ValidateIntervals(
            [new IntervalDto { Opens = "16:00", Closes = "24:00" }, new IntervalDto { Opens = "06:00", Closes = "12:00" }], "Monday");
        Assert.Equal(new TimeOnly(6, 0), ok[0].Opens);
        Assert.Equal("06:00-12:00,16:00-00:00", OpeningHoursCalculator.FormatIntervals(ok));
        Assert.Equal(ok, OpeningHoursCalculator.ParseIntervals("06:00-12:00,16:00-00:00"));
    }
}

/// <summary>Service status expiry, announcement audiences and the publish job, on the real model (SQLite).</summary>
public class OperationsDataTests : IDisposable
{
    private readonly TestDb _db = new();
    private const ulong North = 11, South = 12, Gold = 1, Silver = 2, VipTag = 1;
    // Members: 100 (North, Gold), 101 (South, Silver, VIP tag), 102 (no branch; Gold membership at South),
    // 103 (deleted), 104 (suspended). Staff: 1 admin, 2 trainer.

    public OperationsDataTests()
    {
        _db.SeedGym(1);
        using (var seed = _db.Create(null))
        {
            seed.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 13, TenantId = 1, Name = "Trainer", Slug = "trainer" });
            seed.MembershipPlans.AddRange(
                new MembershipPlan { Id = Gold, TenantId = 1, Name = "Gold", Price = 100 },
                new MembershipPlan { Id = Silver, TenantId = 1, Name = "Silver", Price = 50 });
            seed.Tags.Add(new Tag { Id = VipTag, TenantId = 1, Name = "VIP" });
            seed.SaveChanges();
        }
        AddUser(1, 12);
        AddUser(2, 13);
        _db.AddMember(100, branchId: North);
        _db.AddMember(101, branchId: South);
        _db.AddMember(102);
        _db.AddMember(103);
        _db.AddMember(104);
        using (var seed = _db.Create(null))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            seed.GymMemberships.AddRange(
                new GymMembership { TenantId = 1, UserId = 100, PlanId = Gold, Status = MembershipStatus.Active, StartsAt = today },
                new GymMembership { TenantId = 1, UserId = 101, PlanId = Silver, Status = MembershipStatus.Active, StartsAt = today },
                new GymMembership { TenantId = 1, UserId = 102, PlanId = Gold, BranchId = South, Status = MembershipStatus.Trial, StartsAt = today },
                // Cancelled Silver membership doesn't count.
                new GymMembership { TenantId = 1, UserId = 102, PlanId = Silver, Status = MembershipStatus.Cancelled, StartsAt = today });
            seed.Taggables.Add(new Taggable { TagId = VipTag, TaggableId = 101, TaggableType = "User" });
            seed.Users.Find(103UL)!.DeletedAt = DateTime.UtcNow;
            seed.Users.Find(104UL)!.Status = UserStatus.Suspended;
            seed.SaveChanges();
        }
    }

    private void AddUser(ulong id, ulong roleId)
    {
        using var db = _db.Create(null);
        db.Users.Add(new User { Id = id, TenantId = 1, RoleId = roleId, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local", FirstName = "U", LastName = id.ToString(), Status = UserStatus.Active });
        db.SaveChanges();
    }

    private static FakeUser Background => new() { IsAuthenticated = false, UserId = null, TenantId = null };
    private static FakeUser AdminUser => new() { UserId = 1, Role = "admin", TenantId = 1 };

    private static AnnouncementPublisher Publisher(AppDbContext db, FakeUser? user = null) => new(db, new Notifier(db, user ?? Background));

    private async Task<List<ulong>> Audience(AnnouncementAudience audience, params ulong[] ids)
    {
        using var db = _db.Create(Background);
        return (await AnnouncementAudienceResolver.UserIds(db, 1, audience, ids).ToListAsync()).Order().ToList();
    }

    [Fact]
    public async Task Audiences_resolve_to_the_right_people()
    {
        Assert.Equal([100UL, 101, 102], await Audience(AnnouncementAudience.AllMembers));      // not deleted 103 / suspended 104 / staff
        Assert.Equal([100UL], await Audience(AnnouncementAudience.Branches, North));
        Assert.Equal([101UL, 102], await Audience(AnnouncementAudience.Branches, South));      // home branch or membership branch
        Assert.Equal([100UL, 102], await Audience(AnnouncementAudience.Plans, Gold));          // active + trial
        Assert.Equal([101UL], await Audience(AnnouncementAudience.Plans, Silver));            // 102's cancelled Silver ignored
        Assert.Equal([101UL], await Audience(AnnouncementAudience.Tags, VipTag));
        Assert.Equal([1UL, 2], await Audience(AnnouncementAudience.Staff));
        Assert.Empty(await Audience(AnnouncementAudience.Branches, 999));
    }

    [Fact]
    public async Task Audiences_never_cross_gyms()
    {
        _db.SeedGym(2);
        _db.AddMember(200, tenantId: 2);
        Assert.DoesNotContain(200UL, await Audience(AnnouncementAudience.AllMembers));
    }

    private ulong AddAnnouncement(AnnouncementStatus status, DateTime? publishAt, AnnouncementAudience audience = AnnouncementAudience.AllMembers, string? ids = null)
    {
        using var db = _db.Create(null);
        var a = new Announcement
        {
            TenantId = 1, Title = "Pool reopening", Body = "The pool reopens Monday.", Audience = audience, AudienceIds = ids,
            Status = status, PublishAt = publishAt, IsUrgent = true,
        };
        db.Announcements.Add(a);
        db.SaveChanges();
        return a.Id;
    }

    [Fact]
    public async Task Scheduled_publish_job_is_idempotent()
    {
        var due = AddAnnouncement(AnnouncementStatus.Scheduled, DateTime.UtcNow.AddMinutes(-1));
        var later = AddAnnouncement(AnnouncementStatus.Scheduled, DateTime.UtcNow.AddHours(2));
        var draft = AddAnnouncement(AnnouncementStatus.Draft, null);

        for (var run = 0; run < 3; run++)
        {
            using var db = _db.Create(Background);
            var publisher = Publisher(db);
            publisher.BatchSize = 2; // force paging over the 3 members
            await publisher.PublishDueAsync();
        }

        using var check = _db.Create(null);
        var a = await check.Announcements.SingleAsync(x => x.Id == due);
        Assert.Equal(AnnouncementStatus.Published, a.Status);
        Assert.Equal(3, a.RecipientCount);
        Assert.Null(a.DeliveryLockedUntil);
        Assert.NotNull(a.PublishedAt);
        Assert.Equal([100UL, 101, 102], (await check.AnnouncementRecipients.Where(r => r.AnnouncementId == due).Select(r => r.UserId).ToListAsync()).Order().ToList());
        Assert.Equal(3, await check.Notifications.CountAsync());          // one in-app notification each, despite 3 runs
        Assert.Equal(3, await check.CommunicationLogs.CountAsync(l => l.ProviderRef != null && l.ProviderRef.StartsWith($"announcement:{due}:")));
        Assert.Equal(AnnouncementStatus.Scheduled, (await check.Announcements.SingleAsync(x => x.Id == later)).Status);
        Assert.Equal(AnnouncementStatus.Draft, (await check.Announcements.SingleAsync(x => x.Id == draft)).Status);
    }

    [Fact]
    public async Task An_interrupted_delivery_resumes_without_duplicates()
    {
        var id = AddAnnouncement(AnnouncementStatus.Publishing, DateTime.UtcNow.AddMinutes(-5));
        using (var db = _db.Create(null))
        {
            // A crashed run had saved its first page (member 100); its lease has lapsed.
            var a = db.Announcements.Single(x => x.Id == id);
            a.RecipientCount = 1;
            a.DeliveryLockedUntil = DateTime.UtcNow.AddMinutes(-1);
            db.AnnouncementRecipients.Add(new AnnouncementRecipient { AnnouncementId = id, UserId = 100, TenantId = 1 });
            db.SaveChanges();
        }

        using (var db = _db.Create(Background))
            Assert.Equal(1, await Publisher(db).PublishDueAsync());

        using var check = _db.Create(null);
        Assert.Equal(3, (await check.Announcements.SingleAsync(x => x.Id == id)).RecipientCount);
        Assert.Equal(3, await check.AnnouncementRecipients.CountAsync(r => r.AnnouncementId == id));
        Assert.Equal(2, await check.Notifications.CountAsync()); // only 101 and 102 were notified this time
    }

    [Fact]
    public async Task A_leased_announcement_is_left_to_its_runner()
    {
        var id = AddAnnouncement(AnnouncementStatus.Publishing, DateTime.UtcNow.AddMinutes(-5));
        using (var db = _db.Create(null))
        {
            db.Announcements.Single(x => x.Id == id).DeliveryLockedUntil = DateTime.UtcNow.AddMinutes(3);
            db.SaveChanges();
        }
        using (var db = _db.Create(Background))
            Assert.False(await Publisher(db).DeliverAsync(id));
        using var check = _db.Create(null);
        Assert.Equal(0, await check.AnnouncementRecipients.CountAsync());
    }

    [Fact]
    public async Task Publish_now_delivers_and_members_read_their_feed()
    {
        ulong id;
        using (var db = _db.Create(AdminUser))
        {
            var svc = new AnnouncementService(db, AdminUser, Publisher(db, AdminUser));
            var created = await svc.CreateAsync(new AnnouncementRequest
            {
                Title = "Gold perks", Body = "New sauna hours for Gold.", Audience = "Plans", AudienceIds = [Gold], IsPinned = true, Action = "publish",
            });
            Assert.Equal("Published", created.Status);
            Assert.Equal(2, created.RecipientCount);
            Assert.Equal("Gold", created.AudienceLabel);
            id = created.Id;
        }

        var member = new FakeUser { UserId = 100, Role = "client", TenantId = 1 };
        using (var db = _db.Create(member))
        {
            var svc = new AnnouncementService(db, member, Publisher(db, member));
            var feed = await svc.GetFeedAsync(1, 20);
            Assert.Single(feed.Items);
            Assert.Equal(1, feed.UnreadCount);
            Assert.True(feed.Items[0].IsPinned);
            Assert.Equal(id, (await svc.LatestUnreadAsync())!.Id);
            await svc.GetMineAsync(id);
            Assert.Equal(0, await svc.UnreadCountAsync());
            Assert.Null(await svc.LatestUnreadAsync());
        }

        // Not in the audience: can't see it.
        var other = new FakeUser { UserId = 101, Role = "client", TenantId = 1 };
        using (var db = _db.Create(other))
        {
            var svc = new AnnouncementService(db, other, Publisher(db, other));
            Assert.Empty((await svc.GetFeedAsync(1, 20)).Items);
            await Assert.ThrowsAsync<KeyNotFoundException>(() => svc.GetMineAsync(id));
        }

        using (var db = _db.Create(AdminUser))
        {
            var svc = new AnnouncementService(db, AdminUser, Publisher(db, AdminUser));
            var row = (await svc.ListAsync(null)).Single(a => a.Id == id);
            Assert.Equal(2, row.RecipientCount);
            Assert.Equal(1, row.ReadCount);
        }
    }

    [Fact]
    public async Task Expired_announcements_leave_the_feed()
    {
        var id = AddAnnouncement(AnnouncementStatus.Scheduled, DateTime.UtcNow.AddMinutes(-1));
        using (var db = _db.Create(Background)) await Publisher(db).PublishDueAsync();
        using (var db = _db.Create(null))
        {
            db.Announcements.Single(x => x.Id == id).ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            db.SaveChanges();
        }
        var member = new FakeUser { UserId = 100, Role = "client", TenantId = 1 };
        using var mdb = _db.Create(member);
        var svc = new AnnouncementService(mdb, member, Publisher(mdb, member));
        Assert.Empty((await svc.GetFeedAsync(1, 20)).Items);
        Assert.Equal(0, await svc.UnreadCountAsync());
    }

    [Fact]
    public async Task Service_status_shows_only_while_active_and_for_the_branch()
    {
        var now = new DateTime(2026, 3, 2, 12, 0, 0, DateTimeKind.Utc);
        using (var db = _db.Create(null))
        {
            db.ServiceStatuses.AddRange(
                new ServiceStatus { TenantId = 1, BranchId = North, Area = "Pool", Status = ServiceStatusLevel.Closed, Severity = ServiceStatusSeverity.Critical, Message = "Pool closed", StartsAt = now.AddHours(-1), EndsAt = now.AddHours(5) },
                new ServiceStatus { TenantId = 1, BranchId = North, Area = "Sauna", Message = "Sauna ended", StartsAt = now.AddDays(-2), EndsAt = now.AddMinutes(-1) },
                new ServiceStatus { TenantId = 1, BranchId = North, Area = "Cardio floor", Message = "Later", StartsAt = now.AddHours(1) },
                new ServiceStatus { TenantId = 1, BranchId = null, Severity = ServiceStatusSeverity.Info, Message = "Gym-wide app maintenance", StartsAt = now.AddHours(-1) },
                new ServiceStatus { TenantId = 1, BranchId = South, Message = "South only", StartsAt = now.AddHours(-1) });
            db.SaveChanges();
        }

        using var q = _db.Create(AdminUser);
        var svc = new ServiceStatusService(q, AdminUser);
        var north = await svc.GetActiveAsync(North, now);
        Assert.Equal(["Pool closed", "Gym-wide app maintenance"], north.Select(s => s.Message));
        Assert.Equal("Pool · Closed", north[0].Headline);

        // Five hours later the pool notice has expired by itself.
        var later = await svc.GetActiveAsync(North, now.AddHours(5));
        Assert.DoesNotContain(later, s => s.Message == "Pool closed");
        Assert.Contains(later, s => s.Message == "Later");
    }

    [Fact]
    public async Task Self_check_in_is_blocked_outside_hours_only_when_the_gym_turned_it_on()
    {
        using (var db = _db.Create(null))
        {
            // Branch North keeps the "UTC" default, so the gym's zone (Asia/Kolkata) applies: open 06:00–22:00 IST daily.
            foreach (var d in Enum.GetValues<DayOfWeek>())
                db.BranchOpeningIntervals.Add(new BranchOpeningInterval { TenantId = 1, BranchId = North, DayOfWeek = d, OpensAt = new TimeOnly(6, 0), ClosesAt = new TimeOnly(22, 0) });
            db.SaveChanges();
        }
        var lateNight = new DateTime(2026, 3, 2, 18, 0, 0, DateTimeKind.Utc); // 23:30 IST
        var evening = new DateTime(2026, 3, 2, 14, 0, 0, DateTimeKind.Utc);   // 19:30 IST

        using var db2 = _db.Create(AdminUser);
        var svc = new OpeningHoursService(db2, AdminUser, new ServiceStatusService(db2, AdminUser));
        Assert.Null(await svc.SelfCheckInBlockedReasonAsync(1, North, lateNight)); // setting off by default

        await svc.UpdateSettingsAsync(new OperationsSettings { BlockSelfCheckInOutsideHours = true });
        var reason = await svc.SelfCheckInBlockedReasonAsync(1, North, lateNight);
        Assert.NotNull(reason);
        Assert.Contains("opens 6am", reason);
        Assert.Null(await svc.SelfCheckInBlockedReasonAsync(1, North, evening));
        Assert.Null(await svc.SelfCheckInBlockedReasonAsync(1, South, lateNight)); // no hours set → never blocks
    }

    public void Dispose() => _db.Dispose();
}
