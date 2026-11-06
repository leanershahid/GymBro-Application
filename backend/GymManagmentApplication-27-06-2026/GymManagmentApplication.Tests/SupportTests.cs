using System.IO.Compression;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Application.Support;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Privacy;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Entities.Support;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>Help &amp; feedback (roadmap feature 6): requests, staff queue, SLA, class feedback, privacy.</summary>
public class SupportTests : IDisposable
{
    private readonly TestDb _db = new();
    private const ulong Admin = 1, Trainer = 3, OtherTrainer = 4, Member = 100, OtherMember = 101, OtherGymAdmin = 2, OtherGymMember = 200;
    private const string Photo = "https://res.cloudinary.com/x/image/upload/tenant-1/media/a.jpg";

    public SupportTests()
    {
        _db.SeedGym(1);
        _db.SeedGym(2);
        using (var seed = _db.Create(null))
        {
            seed.Roles.AddRange(
                new Role { Id = 12, TenantId = 1, Name = "Admin", Slug = "admin" },
                new Role { Id = 13, TenantId = 1, Name = "Trainer", Slug = "trainer" },
                new Role { Id = 22, TenantId = 2, Name = "Admin", Slug = "admin" });
            seed.SaveChanges();
            seed.Users.AddRange(
                User(Admin, 1, 12, "Ada"), User(Trainer, 1, 13, "Tom"), User(OtherTrainer, 1, 13, "Tia"), User(OtherGymAdmin, 2, 22, "Bo"));
            seed.SaveChanges();
        }
        _db.AddMember(Member, 1);
        _db.AddMember(OtherMember, 1);
        _db.AddMember(OtherGymMember, 2);
    }

    public void Dispose() => _db.Dispose();

    private static User User(ulong id, ulong tenant, ulong role, string name) => new()
    {
        Id = id, TenantId = tenant, RoleId = role, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
        FirstName = name, LastName = "Staff", Status = UserStatus.Active,
    };

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsAdmin(ulong id = Admin, ulong tenant = 1) => new() { UserId = id, Role = "admin", TenantId = tenant };
    private static FakeUser AsTrainer(ulong id = Trainer) => new() { UserId = id, Role = "trainer", TenantId = 1 };

    private (AppDbContext Db, SupportService Svc) Support(FakeUser me)
    {
        var db = _db.Create(me);
        return (db, new SupportService(db, me, new Notifier(db, me)));
    }

    private async Task<T> As<T>(FakeUser me, Func<SupportService, Task<T>> work)
    {
        var (db, svc) = Support(me);
        using (db) return await work(svc);
    }

    private Task<SupportRequestDetail> RaiseAsync(ulong member = Member, ulong tenant = 1, string subject = "Shower is cold") =>
        As(AsMember(member, tenant), s => s.CreateAsync(new CreateSupportRequestBody
        {
            Category = "facilities", Subject = subject, Message = "The men's showers have had no hot water since Monday.",
            Photos = tenant == 1 ? [Photo] : null, CanContact = true, ContactMethod = "email",
        }));

    private void Shift(ulong requestId, Action<SupportRequest> change)
    {
        using var db = _db.Create(null);
        var r = db.SupportRequests.Single(x => x.Id == requestId);
        change(r);
        db.SaveChanges();
    }

    // ── SLA ────────────────────────────────────────────────────────────────

    [Fact]
    public void Sla_flags_missing_first_response_and_late_resolution_but_not_while_waiting_on_the_member()
    {
        var s = new SupportSettings { FirstResponseHours = 24, ResolutionHours = 72 };
        var now = new DateTime(2026, 11, 5, 12, 0, 0, DateTimeKind.Utc);
        SupportRequest R(double ageHours, string status = SupportStatuses.Open, double? respondedAfter = null) => new()
        {
            CreatedAt = now.AddHours(-ageHours), Status = status,
            FirstResponseAt = respondedAfter is { } h ? now.AddHours(-ageHours + h) : null,
        };

        Assert.Equal(SlaStates.OnTrack, SupportSla.Evaluate(R(2), s, now).FirstResponse.State);
        Assert.Equal(SlaStates.DueSoon, SupportSla.Evaluate(R(20), s, now).FirstResponse.State);   // last 20% of 24h
        var late = SupportSla.Evaluate(R(25), s, now);
        Assert.Equal(SlaStates.Overdue, late.FirstResponse.State);
        Assert.True(late.Overdue);
        Assert.Equal(SlaStates.Met, SupportSla.Evaluate(R(30, respondedAfter: 3), s, now).FirstResponse.State);
        Assert.Equal(SlaStates.Missed, SupportSla.Evaluate(R(30, respondedAfter: 26), s, now).FirstResponse.State);

        // Resolution: overdue only while open; waiting on the member pauses it.
        Assert.True(SupportSla.Evaluate(R(80, respondedAfter: 1), s, now).Overdue);
        Assert.False(SupportSla.Evaluate(R(80, SupportStatuses.Waiting, respondedAfter: 1), s, now).Overdue);
        // Reopening restarts the resolution clock.
        var reopened = R(200, respondedAfter: 1);
        reopened.ReopenedAt = now.AddHours(-5);
        Assert.False(SupportSla.Evaluate(reopened, s, now).Overdue);
        // Resolved late = missed, not overdue.
        var done = R(100, SupportStatuses.Resolved, respondedAfter: 1);
        done.ResolvedAt = now.AddHours(-1);
        Assert.Equal(SlaStates.Missed, SupportSla.Evaluate(done, s, now).Resolution.State);
        Assert.False(SupportSla.Evaluate(done, s, now).Overdue);
    }

    [Fact]
    public async Task Queue_count_and_overdue_filter_follow_the_gym_settings()
    {
        var fresh = await RaiseAsync(subject: "Fresh");
        var old = await RaiseAsync(subject: "Old one");
        Shift(old.Id, r => r.CreatedAt = DateTime.UtcNow.AddHours(-30));

        var count = await As(AsAdmin(), s => s.CountAsync());
        Assert.Equal(2, count.Unassigned);
        Assert.Equal(1, count.Overdue);
        Assert.Equal(2, count.Badge);
        var overdue = await As(AsAdmin(), s => s.QueueAsync(new SupportQueueFilter { Overdue = true }));
        Assert.Equal(old.Id, Assert.Single(overdue.Items).Id);
        Assert.True(overdue.Items.Single().Sla!.Overdue);

        // A longer target makes it on time again.
        using (var db = _db.Create(AsAdmin()))
            await SupportSettingsStore.SaveAsync(db, 1, new SupportSettings { FirstResponseHours = 48, ResolutionHours = 96 });
        Assert.Equal(0, (await As(AsAdmin(), s => s.CountAsync())).Overdue);
        Assert.NotEqual(fresh.Id, old.Id);
    }

    // ── Visibility ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Internal_notes_never_reach_the_member_endpoints()
    {
        var r = await RaiseAsync();
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "SECRET: member is a known complainer", Internal = true }));
        await As(AsAdmin(), s => s.AssignAsync(r.Id, new AssignSupportBody { AssigneeId = Trainer }));
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "Sorry! The boiler is fixed now." }));

        var detail = await As(AsMember(), s => s.MineAsync(r.Id));
        Assert.DoesNotContain(detail.Messages, m => m.IsInternal || m.Body.Contains("SECRET") || m.Body.Contains("Assigned"));
        Assert.Contains(detail.Messages, m => m.Body == "Sorry! The boiler is fixed now." && m.AuthorRole == "staff");
        Assert.Equal(SupportStatuses.Waiting, detail.Status);
        Assert.Null(detail.AssigneeName);
        Assert.Null(detail.Sla);
        var list = await As(AsMember(), s => s.MineAsync());
        Assert.DoesNotContain("SECRET", Assert.Single(list).Preview ?? "");

        var staff = await As(AsAdmin(), s => s.GetAsync(r.Id));
        Assert.Contains(staff.Messages, m => m.IsInternal && m.Body.StartsWith("SECRET"));
        Assert.NotNull(staff.FirstResponseAt);

        // The member was told about the reply; nobody told them about the note.
        using var db = _db.Create(null);
        var titles = db.Notifications.Where(n => n.UserId == Member).Select(n => n.Body ?? "").ToList();
        Assert.Contains(titles, t => t.Contains("boiler"));
        Assert.DoesNotContain(titles, t => t.Contains("SECRET"));
    }

    [Fact]
    public async Task Requests_stay_inside_their_gym_and_with_their_member()
    {
        var mine = await RaiseAsync();
        var otherGym = await RaiseAsync(OtherGymMember, 2, "Gym two problem");

        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherMember), s => s.MineAsync(mine.Id)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherGymMember, 2), s => s.MineAsync(mine.Id)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsAdmin(OtherGymAdmin, 2), s => s.GetAsync(mine.Id)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            As(AsAdmin(OtherGymAdmin, 2), s => s.StaffReplyAsync(mine.Id, new SupportReplyBody { Body = "hi" })));

        var gym1 = await As(AsAdmin(), s => s.QueueAsync(new SupportQueueFilter { Status = "all" }));
        Assert.Equal(mine.Id, Assert.Single(gym1.Items).Id);
        var gym2 = await As(AsAdmin(OtherGymAdmin, 2), s => s.QueueAsync(new SupportQueueFilter { Status = "all" }));
        Assert.Equal(otherGym.Id, Assert.Single(gym2.Items).Id);

        // Photos must be this gym's uploads; staff can't assign another gym's user.
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsMember(OtherGymMember, 2), s => s.CreateAsync(new CreateSupportRequestBody
            { Category = "other", Subject = "x", Message = "y", Photos = [Photo] })));
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsAdmin(), s => s.AssignAsync(mine.Id, new AssignSupportBody { AssigneeId = OtherGymAdmin })));
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsAdmin(), s => s.AssignAsync(mine.Id, new AssignSupportBody { AssigneeId = OtherMember })));
    }

    [Fact]
    public async Task Trainers_only_see_requests_assigned_to_them()
    {
        var a = await RaiseAsync(subject: "For Tom");
        var b = await RaiseAsync(subject: "For Tia");
        await RaiseAsync(subject: "Nobody's");
        await As(AsAdmin(), s => s.AssignAsync(a.Id, new AssignSupportBody { AssigneeId = Trainer }));
        await As(AsAdmin(), s => s.AssignAsync(b.Id, new AssignSupportBody { AssigneeId = OtherTrainer }));

        var tom = await As(AsTrainer(), s => s.QueueAsync(new SupportQueueFilter { Status = "all" }, assignedOnly: true));
        Assert.Equal(a.Id, Assert.Single(tom.Items).Id);
        Assert.Equal(1, (await As(AsTrainer(), s => s.CountAsync(assignedOnly: true))).Badge);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsTrainer(), s => s.GetAsync(b.Id, assignedOnly: true)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            As(AsTrainer(), s => s.StaffReplyAsync(b.Id, new SupportReplyBody { Body = "hi" }, assignedOnly: true)));

        var replied = await As(AsTrainer(), s => s.StaffReplyAsync(a.Id, new SupportReplyBody { Body = "On it", Status = "resolved" }, assignedOnly: true));
        Assert.Equal(SupportStatuses.Resolved, replied.Status);
        // Tom was told he was assigned.
        using var db = _db.Create(null);
        Assert.True(db.Notifications.Any(n => n.UserId == Trainer && n.Title.Contains("assigned")));
    }

    // ── Member actions ─────────────────────────────────────────────────────

    [Fact]
    public async Task Resolved_requests_reopen_within_seven_days_only()
    {
        var r = await RaiseAsync();
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "Fixed", Status = "resolved" }));
        var resolved = await As(AsMember(), s => s.MineAsync(r.Id));
        Assert.True(resolved.CanReopen);
        Assert.NotNull(resolved.ReopenUntil);

        var reopened = await As(AsMember(), s => s.ReopenAsync(r.Id, new ReopenSupportBody { Message = "Still cold today" }));
        Assert.Equal(SupportStatuses.Open, reopened.Status);
        Assert.Equal(1, reopened.ReopenCount);

        await As(AsAdmin(), s => s.SetStatusAsync(r.Id, new SupportStatusBody { Status = "resolved" }));
        Shift(r.Id, x => x.ResolvedAt = DateTime.UtcNow.AddDays(-8));
        var tooLate = await Assert.ThrowsAsync<RuleException>(() => As(AsMember(), s => s.ReopenAsync(r.Id, null)));
        Assert.Contains("7 days", tooLate.Message);
        await Assert.ThrowsAsync<RuleException>(() => As(AsMember(), s => s.MemberReplyAsync(r.Id, new SupportReplyBody { Body = "hello?" })));

        // The job closes it; closed requests can't take replies either.
        using (var db = _db.Create(null))
            Assert.Equal(1, await new SupportJobService(db, new Notifier(db, new FakeUser { IsAuthenticated = false, UserId = null })).CloseStaleAsync(1, DateTime.UtcNow));
        Assert.Equal(SupportStatuses.Closed, (await As(AsMember(), s => s.MineAsync(r.Id))).Status);
    }

    [Fact]
    public async Task A_reply_to_a_recently_resolved_request_reopens_it()
    {
        var r = await RaiseAsync();
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "Fixed", Status = "resolved" }));
        var d = await As(AsMember(), s => s.MemberReplyAsync(r.Id, new SupportReplyBody { Body = "Not really" }));
        Assert.Equal(SupportStatuses.Open, d.Status);
        Assert.Equal(1, d.ReopenCount);
    }

    [Fact]
    public async Task Satisfaction_rating_is_accepted_once_after_resolution()
    {
        var r = await RaiseAsync();
        await Assert.ThrowsAsync<RuleException>(() => As(AsMember(), s => s.RateAsync(r.Id, new RateSupportBody { Score = 5 })));
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "Fixed", Status = "resolved" }));
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsMember(), s => s.RateAsync(r.Id, new RateSupportBody { Score = 6 })));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherMember), s => s.RateAsync(r.Id, new RateSupportBody { Score = 1 })));

        var rated = await As(AsMember(), s => s.RateAsync(r.Id, new RateSupportBody { Score = 4, Comment = "Quick fix" }));
        Assert.Equal((byte)4, rated.Rating);
        Assert.False(rated.CanRate);
        var again = await Assert.ThrowsAsync<RuleException>(() => As(AsMember(), s => s.RateAsync(r.Id, new RateSupportBody { Score = 1 })));
        Assert.Equal(RuleException.ConflictStatus, again.StatusCode);
    }

    // ── Class feedback ─────────────────────────────────────────────────────

    private ulong AttendedBooking(ulong member = Member, BookingStatus status = BookingStatus.Attended)
    {
        using var db = _db.Create(null);
        var type = db.ClassTypes.FirstOrDefault(t => t.TenantId == 1) ?? new ClassType { TenantId = 1, Name = "HIIT" };
        if (type.Id == 0) { db.ClassTypes.Add(type); db.SaveChanges(); }
        var cls = new GymClass { TenantId = 1, BranchId = 11, ClassTypeId = type.Id, StartsAt = DateTime.UtcNow.AddHours(-3), EndsAt = DateTime.UtcNow.AddHours(-2) };
        db.GymClasses.Add(cls);
        db.SaveChanges();
        var b = new ClassBooking { TenantId = 1, ClassId = cls.Id, ClientId = member, Status = status };
        db.ClassBookings.Add(b);
        db.SaveChanges();
        return b.Id;
    }

    [Fact]
    public async Task Class_feedback_is_asked_once_per_attended_booking()
    {
        var booking = AttendedBooking();
        var noShow = AttendedBooking(status: BookingStatus.NoShow);

        using (var db = _db.Create(AsMember()))
        {
            var svc = new ClassFeedbackService(db, AsMember());
            var pending = await svc.PendingAsync();
            Assert.Equal(booking, pending!.BookingId);
            Assert.Equal("HIIT", pending.ClassName);
            await Assert.ThrowsAsync<RuleException>(() => svc.SubmitAsync(new ClassFeedbackBody { BookingId = noShow, Score = 5 }));
            await svc.SubmitAsync(new ClassFeedbackBody { BookingId = booking, Score = 4, Comment = "Great energy" });
        }
        using (var db = _db.Create(AsMember()))
        {
            var svc = new ClassFeedbackService(db, AsMember());
            Assert.Null(await svc.PendingAsync());
            var dup = await Assert.ThrowsAsync<RuleException>(() => svc.SubmitAsync(new ClassFeedbackBody { BookingId = booking, Score = 1 }));
            Assert.Equal(RuleException.ConflictStatus, dup.StatusCode);
        }
        using (var db = _db.Create(AsMember(OtherMember)))
            await Assert.ThrowsAsync<KeyNotFoundException>(() => new ClassFeedbackService(db, AsMember(OtherMember)).SubmitAsync(new ClassFeedbackBody { BookingId = booking, Score = 2 }));

        using (var db = _db.Create(AsAdmin()))
        {
            var summary = await new ClassFeedbackService(db, AsAdmin()).SummaryAsync();
            Assert.Equal(4, Assert.Single(summary.ByClassType).Average);
            Assert.Equal("Great energy", Assert.Single(summary.RecentComments).Comment);
        }

        // Turned off by the gym: nothing is asked.
        AttendedBooking();
        using (var db = _db.Create(AsAdmin()))
            await SupportSettingsStore.SaveAsync(db, 1, new SupportSettings { PostClassFeedback = false });
        using (var db = _db.Create(AsMember()))
            Assert.Null(await new ClassFeedbackService(db, AsMember()).PendingAsync());
    }

    // ── Notifications ──────────────────────────────────────────────────────

    [Fact]
    public async Task Overdue_digest_goes_to_admins_once_a_day()
    {
        var r = await RaiseAsync();
        Shift(r.Id, x => x.CreatedAt = DateTime.UtcNow.AddHours(-30));
        var day = DateOnly.FromDateTime(DateTime.UtcNow);
        async Task<int> Run(int hour)
        {
            using var db = _db.Create(null);
            return await new SupportJobService(db, new Notifier(db, new FakeUser { IsAuthenticated = false, UserId = null })).SendDigestAsync(1, DateTime.UtcNow, day, hour);
        }
        Assert.Equal(0, await Run(6));
        Assert.Equal(1, await Run(9));
        Assert.Equal(0, await Run(10));
        using var check = _db.Create(null);
        Assert.Single(check.CommunicationLogs.Where(l => l.UserId == Admin && l.ProviderRef == SupportJobService.DigestKey(1, day, Admin)));
        Assert.False(check.Notifications.Any(n => n.UserId == OtherGymAdmin));
    }

    // ── Privacy ────────────────────────────────────────────────────────────

    private PrivacyProcessor Processor(AppDbContext db, NullStorage storage) =>
        new(db, storage, new EmailOutbox(db), new Notifier(db, new FakeUser { UserId = null, IsAuthenticated = false }), NullLogger<PrivacyProcessor>.Instance);

    [Fact]
    public async Task Privacy_export_includes_the_members_requests_without_internal_notes()
    {
        var r = await RaiseAsync();
        await RaiseAsync(OtherMember, subject: "Someone else's");
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "STAFF ONLY note", Internal = true }));
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "We're on it" }));
        var booking = AttendedBooking();
        using (var db = _db.Create(AsMember()))
            await new ClassFeedbackService(db, AsMember()).SubmitAsync(new ClassFeedbackBody { BookingId = booking, Score = 5, Comment = "Loved it" });

        using var pdb = _db.Create(null);
        var zip = await Processor(pdb, new NullStorage()).BuildExportZipAsync(1, Member, DateTime.UtcNow);
        using var archive = new ZipArchive(new MemoryStream(zip));
        using var json = JsonDocument.Parse(archive.GetEntry("data.json")!.Open());
        var sections = json.RootElement.GetProperty("sections");
        var requests = sections.GetProperty("supportRequests");
        Assert.Equal(1, requests.GetArrayLength());
        Assert.Equal("Shower is cold", requests[0].GetProperty("subject").GetString());
        Assert.Equal(2, requests[0].GetProperty("messages").GetArrayLength());
        Assert.Equal(1, sections.GetProperty("classFeedback").GetArrayLength());
        var raw = json.RootElement.GetRawText();
        Assert.DoesNotContain("STAFF ONLY", raw);
        Assert.DoesNotContain("Someone else", raw);
        Assert.Contains("Help requests", new StreamReader(archive.GetEntry("summary.html")!.Open()).ReadToEnd());
    }

    [Fact]
    public async Task Anonymisation_redacts_the_members_texts_and_keeps_the_rows()
    {
        var r = await RaiseAsync();
        var other = await RaiseAsync(OtherMember, subject: "Keep me");
        await As(AsAdmin(), s => s.StaffReplyAsync(r.Id, new SupportReplyBody { Body = "Fixed", Status = "resolved" }));
        await As(AsMember(), s => s.RateAsync(r.Id, new RateSupportBody { Score = 3, Comment = "Slow, Ravi at desk was rude" }));
        var booking = AttendedBooking();
        using (var db = _db.Create(AsMember()))
            await new ClassFeedbackService(db, AsMember()).SubmitAsync(new ClassFeedbackBody { BookingId = booking, Score = 2, Comment = "My knee hurt" });

        var storage = new NullStorage();
        using (var db = _db.Create(null))
        {
            var request = new AccountDeletionRequest { TenantId = 1, UserId = Member, RequestedByUserId = Member, ScheduledFor = DateTime.UtcNow.AddDays(-1) };
            db.AccountDeletionRequests.Add(request);
            await db.SaveChangesAsync();
            Assert.True(await Processor(db, storage).ExecuteAsync(request, null, DateTime.UtcNow));
        }

        using var check = _db.Create(null);
        var row = check.SupportRequests.Single(x => x.Id == r.Id);
        Assert.Equal(SupportCommon.RedactedText, row.Subject);
        Assert.Null(row.RatingComment);
        Assert.Equal((byte)3, row.Rating);              // kept for stats
        Assert.Equal("facilities", row.Category);
        Assert.NotNull(row.RedactedAt);
        var messages = check.SupportMessages.Where(m => m.RequestId == r.Id).ToList();
        Assert.All(messages.Where(m => m.AuthorId == Member && m.Kind == SupportMessageKinds.Message), m =>
        {
            Assert.Equal(SupportCommon.RedactedText, m.Body);
            Assert.Null(m.Photos);
        });
        Assert.Contains(messages, m => m.Body == "Fixed");     // the gym's reply stays
        Assert.Contains(Photo, storage.Deleted);
        Assert.Null(check.ClassFeedbacks.Single(f => f.BookingId == booking).Comment);
        Assert.Equal("Keep me", check.SupportRequests.Single(x => x.Id == other.Id).Subject);
    }

    private sealed class NullStorage : IFileStorage
    {
        public readonly List<string> Deleted = [];
        public Task<string> SaveAsync(FileUpload file, string folder, FileKind kind) => Task.FromResult($"https://store/authenticated/{folder}/{Guid.NewGuid():N}.zip");
        public Task DeleteAsync(string? url) { if (url is not null) Deleted.Add(url); return Task.CompletedTask; }
        public Task<string> GetSignedUrlAsync(string url) => Task.FromResult(url);
    }
}
