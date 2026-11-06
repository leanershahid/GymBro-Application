using System.Net;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Application.Scheduling;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Safety;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Push;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace GymManagmentApplication.Tests;

/// <summary>Reminder timing rules, quiet hours and preference defaults (pure functions).</summary>
public class NotificationPolicyTests
{
    private static readonly DateTime Start = new(2026, 11, 10, 18, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData(-72, 24.5, null)]   // more than 24 h ahead: nothing yet
    [InlineData(-72, 24, "24h")]    // exactly 24 h before
    [InlineData(-72, 13, "24h")]    // catch-up window
    [InlineData(-72, 12, null)]     // 12 h – 2 h: nothing
    [InlineData(-72, 2, "2h")]
    [InlineData(-72, 0.5, "2h")]
    [InlineData(-72, 0.1, null)]    // under 10 min: too late
    [InlineData(-20, 20, null)]     // booked 20 h ahead: no "tomorrow" reminder
    [InlineData(-1.5, 1, null)]     // booked 1.5 h ahead: no 2 h reminder
    public void Reminders_are_due_24h_and_2h_before_start(double bookedHoursBefore, double hoursBefore, string? expected)
    {
        var bookedAt = Start.AddHours(bookedHoursBefore);
        var now = Start.AddHours(-hoursBefore);
        Assert.Equal(expected, NotificationPolicy.DueReminder(Start, bookedAt, now));
    }

    [Theory]
    [InlineData("23:30", true)]
    [InlineData("02:00", true)]
    [InlineData("06:59", true)]
    [InlineData("07:00", false)]
    [InlineData("12:00", false)]
    [InlineData("21:59", false)]
    [InlineData("22:00", true)]
    public void Default_quiet_hours_wrap_midnight(string local, bool quiet) =>
        Assert.Equal(quiet, NotificationPolicy.InQuietHours(TimeOnly.Parse(local), new TimeOnly(22, 0), new TimeOnly(7, 0)));

    [Fact]
    public void A_push_in_quiet_hours_waits_until_they_end_in_the_members_time_zone_unless_urgent()
    {
        var kolkata = TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"); // UTC+5:30
        var lateEvening = new DateTime(2026, 11, 10, 17, 45, 0, DateTimeKind.Utc); // 23:15 local
        var after = NotificationPolicy.SendAfter(lateEvening, kolkata, true, new(22, 0), new(7, 0), urgent: false);
        Assert.Equal(new DateTime(2026, 11, 11, 1, 30, 0, DateTimeKind.Utc), after); // 07:00 local next day

        var earlyMorning = new DateTime(2026, 11, 10, 22, 0, 0, DateTimeKind.Utc); // 03:30 local on the 11th
        Assert.Equal(new DateTime(2026, 11, 11, 1, 30, 0, DateTimeKind.Utc),
            NotificationPolicy.SendAfter(earlyMorning, kolkata, true, new(22, 0), new(7, 0), urgent: false));

        Assert.Equal(lateEvening, NotificationPolicy.SendAfter(lateEvening, kolkata, true, new(22, 0), new(7, 0), urgent: true));
        Assert.Equal(lateEvening, NotificationPolicy.SendAfter(lateEvening, kolkata, false, new(22, 0), new(7, 0), urgent: false));
        var noon = new DateTime(2026, 11, 10, 6, 30, 0, DateTimeKind.Utc); // 12:00 local
        Assert.Equal(noon, NotificationPolicy.SendAfter(noon, kolkata, true, new(22, 0), new(7, 0), urgent: false));
    }

    [Fact]
    public void Defaults_are_transactional_on_marketing_off_and_overrides_win()
    {
        Assert.True(NotificationPolicy.Allows(null, NotificationCategories.ClassReminders, NotificationChannels.Push));
        Assert.True(NotificationPolicy.Allows(null, NotificationCategories.Billing, NotificationChannels.Email));
        Assert.False(NotificationPolicy.Allows(null, NotificationCategories.Marketing, NotificationChannels.Push));
        Assert.True(NotificationPolicy.Allows(null, NotificationCategories.General, NotificationChannels.Push));

        var doc = JsonDocument.Parse("""{"class_reminders":{"push":false,"email":true},"marketing":{"push":true}}""");
        Assert.False(NotificationPolicy.Allows(doc, NotificationCategories.ClassReminders, NotificationChannels.Push));
        Assert.True(NotificationPolicy.Allows(doc, NotificationCategories.ClassReminders, NotificationChannels.Email));
        Assert.True(NotificationPolicy.Allows(doc, NotificationCategories.Marketing, NotificationChannels.Push));
        Assert.False(NotificationPolicy.Allows(doc, NotificationCategories.Marketing, NotificationChannels.Email));
    }
}

/// <summary>Reminder scheduling, the push outbox (preferences, quiet hours, Expo tickets/receipts) on the SQLite test db.</summary>
public class PushOutboxTests : IDisposable
{
    private readonly TestDb _db = new();
    private const string Token100 = "ExponentPushToken[member-100-xxxxxxxxxxxx]";
    private const string Token101 = "ExponentPushToken[member-101-xxxxxxxxxxxx]";

    public PushOutboxTests()
    {
        _db.SeedGym(1);
        _db.AddMember(100, branchId: 11);
        _db.AddMember(101, branchId: 11);
        using var db = _db.Create(null);
        db.PushDevices.Add(new PushDevice { TenantId = 1, UserId = 100, Token = Token100, Platform = PushPlatforms.Android });
        db.PushDevices.Add(new PushDevice { TenantId = 1, UserId = 101, Token = Token101, Platform = PushPlatforms.Ios });
        db.SaveChanges();
    }

    private ulong AddClass(DateTime startsAt, short? capacity = 10)
    {
        using var db = _db.Create(null);
        var type = new ClassType { TenantId = 1, Name = "Spin" };
        var c = new GymClass { TenantId = 1, BranchId = 11, ClassType = type, Title = "Spin", StartsAt = startsAt, EndsAt = startsAt.AddHours(1), MaxCapacity = capacity };
        db.GymClasses.Add(c);
        db.SaveChanges();
        return c.Id;
    }

    private void Book(ulong classId, ulong clientId, DateTime bookedAt, BookingStatus status = BookingStatus.Booked)
    {
        using var db = _db.Create(null);
        db.ClassBookings.Add(new ClassBooking { TenantId = 1, ClassId = classId, ClientId = clientId, Status = status, BookedAt = bookedAt });
        db.SaveChanges();
    }

    private static Notifier BackgroundNotifier(AppDbContext db) => new(db, new FakeUser { IsAuthenticated = false, UserId = null, Role = "" });

    [Fact]
    public async Task Reminders_are_queued_once_per_booking_and_kind()
    {
        var now = DateTime.UtcNow;
        var classId = AddClass(now.AddMinutes(90));
        Book(classId, 100, now.AddDays(-3));

        for (var run = 0; run < 3; run++)
        {
            using var db = _db.Create(null);
            await new ReminderService(db, BackgroundNotifier(db)).QueueDueAsync(1, now.AddMinutes(run * 5));
        }

        using var check = _db.Create(null);
        var pushes = check.CommunicationLogs.Where(l => l.Channel == CommunicationChannel.Push).ToList();
        var push = Assert.Single(pushes);
        Assert.StartsWith("class-reminder:", push.ProviderRef);
        Assert.EndsWith(":2h", push.ProviderRef);
        Assert.Equal(1, check.Notifications.Count(n => n.UserId == 100));
        var meta = PushMeta.From(push.Meta);
        Assert.Equal(NotificationCategories.ClassReminders, meta.Category);
        Assert.Equal($"classes/{classId}", meta.Route);
        Assert.NotNull(meta.ExpiresAt);
    }

    [Fact]
    public async Task The_outbox_honours_preferences_expiry_and_sends_the_rest()
    {
        using (var db = _db.Create(null))
        {
            db.NotificationPreferences.Add(new NotificationPreference
            {
                TenantId = 1, UserId = 101, QuietHoursEnabled = false,
                Channels = JsonDocument.Parse("""{"billing":{"push":false,"email":true}}"""),
            });
            var n = BackgroundNotifier(db);
            n.Add(1, 100, "New invoice", "Due soon", "billing", null);                                 // sent
            n.Add(1, 101, "New invoice", "Due soon", "billing", null);                                 // opted out
            n.Add(1, 100, "Promo", "20% off", "marketing", null);                                      // marketing default off
            n.Add(1, 100, "Spin starts in 2 hours", null, "class_reminder", 5, expiresAt: DateTime.UtcNow.AddMinutes(-1)); // too late
            db.SaveChanges();
        }

        var sender = new FakeSender();
        using (var db = _db.Create(null))
            await new PushDispatcher(db, sender, NullLogger<PushDispatcher>.Instance).SendDueAsync(NoonInKolkata());

        Assert.Single(sender.Sent);
        Assert.Equal(Token100, sender.Sent[0].To);
        Assert.Equal("billing", sender.Sent[0].Data["route"]);
        using var check = _db.Create(null);
        var rows = check.CommunicationLogs.Where(l => l.Channel == CommunicationChannel.Push).ToList()
            .Select(r => (r.Subject, r.UserId, r.Status, PushMeta.From(r.Meta).Reason)).ToList();
        Assert.Contains(("New invoice", (ulong?)100, CommunicationStatus.Sent, (string?)null), rows);
        Assert.Contains(("New invoice", (ulong?)101, CommunicationStatus.Failed, (string?)"opted_out"), rows);
        Assert.Contains(("Promo", (ulong?)100, CommunicationStatus.Failed, (string?)"opted_out"), rows);
        Assert.Contains(("Spin starts in 2 hours", (ulong?)100, CommunicationStatus.Failed, (string?)"expired"), rows);
    }

    [Fact]
    public async Task Quiet_hours_defer_a_push_and_urgent_alerts_go_straight_out()
    {
        using (var db = _db.Create(null))
        {
            var n = BackgroundNotifier(db);
            n.Add(1, 100, "New workout assigned", null, "training", 1);
            n.Add(1, 100, "Class cancelled", null, "booking", 7, urgent: true);
            db.SaveChanges();
        }
        var lateEvening = new DateTime(2026, 11, 10, 17, 45, 0, DateTimeKind.Utc); // 23:15 in Asia/Kolkata (gym zone)
        var sender = new FakeSender();
        using (var db = _db.Create(null))
            await new PushDispatcher(db, sender, NullLogger<PushDispatcher>.Instance).SendDueAsync(lateEvening);

        Assert.Equal("Class cancelled", Assert.Single(sender.Sent).Title);
        using var check = _db.Create(null);
        var deferred = check.CommunicationLogs.Single(l => l.Subject == "New workout assigned");
        Assert.Equal(CommunicationStatus.Queued, deferred.Status);
        Assert.Equal(new DateTime(2026, 11, 11, 1, 30, 0, DateTimeKind.Utc), deferred.NotBefore);
    }

    [Fact]
    public async Task DeviceNotRegistered_from_Expo_disables_the_token_on_send_and_on_receipts()
    {
        using (var db = _db.Create(null))
        {
            var n = BackgroundNotifier(db);
            n.Add(1, 100, "Hi 100", null, "training", null);
            n.Add(1, 101, "Hi 101", null, "training", null);
            db.SaveChanges();
        }

        // Expo answers the send with one error ticket (100) and one ok ticket (101); the receipt
        // for 101's ticket later says the app was uninstalled.
        var handler = new StubHandler(req => req.RequestUri!.AbsolutePath.EndsWith("/send")
            ? """{"data":[{"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}},{"status":"ok","id":"ticket-101"}]}"""
            : """{"data":{"ticket-101":{"status":"error","message":"gone","details":{"error":"DeviceNotRegistered"}}}}""");
        var sender = new ExpoPushSender(new StubFactory(handler), Options.Create(new PushSettings { ExpoAccessToken = "test-token" }));

        var now = NoonInKolkata();
        using (var db = _db.Create(null))
            await new PushDispatcher(db, sender, NullLogger<PushDispatcher>.Instance).SendDueAsync(now);

        using (var check = _db.Create(null))
        {
            Assert.NotNull(check.PushDevices.Single(d => d.UserId == 100).DisabledAt);
            Assert.Null(check.PushDevices.Single(d => d.UserId == 101).DisabledAt);
            Assert.Equal(CommunicationStatus.Failed, check.CommunicationLogs.Single(l => l.Subject == "Hi 100").Status);
            Assert.Equal(CommunicationStatus.Sent, check.CommunicationLogs.Single(l => l.Subject == "Hi 101").Status);
        }
        Assert.Equal("Bearer test-token", handler.Requests[0].Headers.Authorization?.ToString());
        Assert.Contains("ExponentPushToken[member-100", handler.Bodies[0]);

        using (var db = _db.Create(null))
            await new PushDispatcher(db, sender, NullLogger<PushDispatcher>.Instance).CheckReceiptsAsync(now.AddMinutes(20));

        using var after = _db.Create(null);
        var device = after.PushDevices.Single(d => d.UserId == 101);
        Assert.NotNull(device.DisabledAt);
        Assert.Equal(PushDispatcher.DeviceNotRegistered, device.DisabledReason);
        Assert.Equal(CommunicationStatus.Delivered, after.CommunicationLogs.Single(l => l.Subject == "Hi 101").Status);

        // Disabled devices get nothing more.
        using (var db = _db.Create(null))
        {
            BackgroundNotifier(db).Add(1, 100, "Again", null, "training", null);
            db.SaveChanges();
            await new PushDispatcher(db, sender, NullLogger<PushDispatcher>.Instance).SendDueAsync(now.AddMinutes(30));
        }
        using var last = _db.Create(null);
        Assert.Equal("no_device", PushMeta.From(last.CommunicationLogs.Single(l => l.Subject == "Again").Meta).Reason);
    }

    [Fact]
    public async Task Marketing_toggles_write_consent_records()
    {
        var me = new FakeUser { Role = "client", UserId = 100 };
        using (var db = _db.Create(me))
        {
            var svc = new NotificationPreferenceService(db, me, new ConsentService(db, me));
            var res = await svc.UpdateMineAsync(new UpdateNotificationPreferencesRequest
            {
                Categories = [new() { Category = "marketing", Push = true, Email = false }, new() { Category = "class_reminders", Push = false, Email = true }],
                QuietStart = "23:00",
            });
            Assert.True(res.Categories.Single(c => c.Category == "marketing").Push);
            Assert.False(res.Categories.Single(c => c.Category == "class_reminders").Push);
            Assert.Equal("23:00", res.QuietStart);
            Assert.True(res.HasPushDevice);
            await Assert.ThrowsAsync<ArgumentException>(() => svc.UpdateMineAsync(new() { Categories = [new() { Category = "nope" }] }));
        }
        using var check = _db.Create(null);
        var consent = Assert.Single(check.ConsentRecords.Where(c => c.UserId == 100));
        Assert.Equal(ConsentTypes.MarketingPush, consent.Type);
        Assert.True(consent.Granted);
    }

    private static DateTime NoonInKolkata() => new(2026, 11, 10, 6, 30, 0, DateTimeKind.Utc);

    public void Dispose() => _db.Dispose();

    private sealed class FakeSender : IPushSender
    {
        public List<PushMessage> Sent { get; } = [];
        public Task<IReadOnlyList<PushTicket>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default)
        {
            Sent.AddRange(messages);
            return Task.FromResult<IReadOnlyList<PushTicket>>(messages.Select((_, i) => new PushTicket(true, $"t{Sent.Count}-{i}", null, null)).ToList());
        }
        public Task<IReadOnlyDictionary<string, PushTicket>> GetReceiptsAsync(IReadOnlyCollection<string> ticketIds, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyDictionary<string, PushTicket>>(new Dictionary<string, PushTicket>());
    }

    private sealed class StubHandler(Func<HttpRequestMessage, string> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];
        public List<string> Bodies { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            Bodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(respond(request), Encoding.UTF8, "application/json") };
        }
    }

    private sealed class StubFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }
}

/// <summary>"Offer" waitlist mode: freed seats are held for the next member, expire and roll on.</summary>
public class WaitlistOfferTests : IDisposable
{
    private readonly TestDb _db = new();
    private readonly ulong _classId;

    public WaitlistOfferTests()
    {
        _db.SeedGym(1);
        foreach (var id in new ulong[] { 100, 101, 102, 103 }) _db.AddMember(id);
        using var db = _db.Create(null);
        db.TenantSettings.Add(new Domain.Entities.Core.TenantSetting
        {
            TenantId = 1, Key = WaitlistOfferService.SettingKey,
            Value = JsonDocument.Parse("""{"waitlistMode":"offer","claimWindowMinutes":30}"""),
        });
        var c = new GymClass
        {
            TenantId = 1, BranchId = 11, ClassType = new ClassType { TenantId = 1, Name = "Spin" }, Title = "Spin",
            StartsAt = DateTime.UtcNow.AddDays(1), EndsAt = DateTime.UtcNow.AddDays(1).AddHours(1), MaxCapacity = 1,
        };
        db.GymClasses.Add(c);
        db.SaveChanges();
        _classId = c.Id;
    }

    private ClassService Service(AppDbContext db, ulong me)
    {
        var user = new FakeUser { Role = "client", UserId = me };
        return new ClassService(db, user, new Notifier(db, user));
    }

    private async Task Book(ulong me)
    {
        using var db = _db.Create(new FakeUser { Role = "client", UserId = me });
        await Service(db, me).BookAsync(_classId, new BookClassRequest());
    }

    private Dictionary<ulong, BookingStatus> Statuses()
    {
        using var db = _db.Create(null);
        return db.ClassBookings.Where(b => b.ClassId == _classId).ToDictionary(b => b.ClientId, b => b.Status);
    }

    private List<WaitlistOffer> Offers()
    {
        using var db = _db.Create(null);
        return db.WaitlistOffers.Where(o => o.ClassId == _classId).ToList().OrderBy(o => o.Id).ToList();
    }

    [Fact]
    public async Task A_freed_seat_is_offered_held_expires_and_rolls_to_the_next_member()
    {
        await Book(100);
        await Book(101);
        await Book(102);
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 100 }))
            await Service(db, 100).CancelBookingAsync(_classId, null);

        // 101 is offered the seat but not booked yet; the seat is held, so a newcomer is waitlisted.
        var offer = Assert.Single(Offers());
        Assert.Equal(101UL, offer.ClientId);
        Assert.Equal(WaitlistOfferStatuses.Pending, offer.Status);
        Assert.InRange((offer.ExpiresAt - offer.OfferedAt).TotalMinutes, 29.9, 30.1);
        Assert.Equal(BookingStatus.Waitlisted, Statuses()[101]);
        await Book(103);
        Assert.Equal(BookingStatus.Waitlisted, Statuses()[103]);
        using (var db = _db.Create(null))
        {
            var push = db.CommunicationLogs.Single(l => l.UserId == 101 && l.Channel == CommunicationChannel.Push);
            Assert.Equal("A spot opened up", push.Subject);
            Assert.Contains("claim it by", push.Body);
            var meta = PushMeta.From(push.Meta);
            Assert.True(meta.Urgent);
            Assert.Equal($"classes/{_classId}/offer", meta.Route);
        }

        // The window passes: the scheduler expires it, 101 leaves the waitlist, 102 gets the offer.
        using (var db = _db.Create(null))
            Assert.Equal(1, await new WaitlistOfferService(db, new Notifier(db, new FakeUser { IsAuthenticated = false, UserId = null }))
                .ExpireDueForClassAsync(_classId, offer.ExpiresAt.AddSeconds(1)));
        var offers = Offers();
        Assert.Equal(WaitlistOfferStatuses.Expired, offers[0].Status);
        Assert.Equal(102UL, offers[1].ClientId);
        Assert.Equal(WaitlistOfferStatuses.Pending, offers[1].Status);
        Assert.Equal(BookingStatus.Cancelled, Statuses()[101]);

        // 102 claims in time and is booked; nothing more is offered.
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 102 }))
        {
            var (cls, claimed) = await Service(db, 102).ClaimOfferAsync(_classId);
            Assert.True(claimed);
            Assert.Equal("Booked", cls.MyBooking);
        }
        Assert.Equal(BookingStatus.Booked, Statuses()[102]);
        Assert.Equal(BookingStatus.Waitlisted, Statuses()[103]);
        Assert.Equal(WaitlistOfferStatuses.Claimed, Offers()[1].Status);
        Assert.Equal(2, Offers().Count);
    }

    [Fact]
    public async Task Declining_rolls_the_offer_on_and_a_late_claim_fails()
    {
        await Book(100);
        await Book(101);
        await Book(102);
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 100 }))
            await Service(db, 100).CancelBookingAsync(_classId, null);
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 101 }))
            await Service(db, 101).DeclineOfferAsync(_classId);

        var offers = Offers();
        Assert.Equal(WaitlistOfferStatuses.Declined, offers[0].Status);
        Assert.Equal(102UL, offers[1].ClientId);

        // Make 102's offer lapse, then claim: refused, and it rolls on (nobody left → seat free).
        using (var db = _db.Create(null))
        {
            var o = db.WaitlistOffers.Single(x => x.Id == offers[1].Id);
            o.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            db.SaveChanges();
        }
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 102 }))
        {
            var (_, claimed) = await Service(db, 102).ClaimOfferAsync(_classId);
            Assert.False(claimed);
        }
        Assert.Equal(WaitlistOfferStatuses.Expired, Offers()[1].Status);
        Assert.Equal(BookingStatus.Cancelled, Statuses()[102]);
        await Book(103);
        Assert.Equal(BookingStatus.Booked, Statuses()[103]); // the seat is free again
    }

    [Fact]
    public async Task Auto_mode_keeps_promoting_directly()
    {
        using (var db = _db.Create(null))
        {
            db.TenantSettings.Single(s => s.Key == WaitlistOfferService.SettingKey).Value = JsonDocument.Parse("""{"waitlistMode":"auto"}""");
            db.SaveChanges();
        }
        await Book(100);
        await Book(101);
        using (var db = _db.Create(new FakeUser { Role = "client", UserId = 100 }))
            await Service(db, 100).CancelBookingAsync(_classId, null);
        Assert.Equal(BookingStatus.Booked, Statuses()[101]);
        Assert.Empty(Offers());
        using var check = _db.Create(null);
        Assert.Equal("You're in!", check.CommunicationLogs.Single(l => l.UserId == 101 && l.Channel == CommunicationChannel.Push).Subject);
    }

    public void Dispose() => _db.Dispose();
}
