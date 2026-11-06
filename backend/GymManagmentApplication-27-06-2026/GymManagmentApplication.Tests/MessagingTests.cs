using System.IO.Compression;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Messaging;
using GymManagmentApplication.Application.Privacy;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Messaging;
using GymManagmentApplication.Domain.Entities.Privacy;
using GymManagmentApplication.Domain.Entities.Support;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>Trainer ↔ member messaging (roadmap feature 8): relationship, safeguarding, idempotency, push, review, privacy.</summary>
public class MessagingTests : IDisposable
{
    private readonly TestDb _db = new();
    private const ulong Admin = 1, Trainer = 3, OtherTrainer = 4, Member = 100, OtherMember = 101, OtherGymAdmin = 2, OtherGymMember = 200;
    private const string Photo = "https://res.cloudinary.com/x/image/upload/tenant-1/media/m.jpg";
    private readonly ulong _profile;
    private readonly ulong _otherProfile;

    public MessagingTests()
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
            seed.Users.AddRange(User(Admin, 1, 12, "Ada"), User(Trainer, 1, 13, "Tom"), User(OtherTrainer, 1, 13, "Tia"), User(OtherGymAdmin, 2, 22, "Bo"));
            seed.SaveChanges();
        }
        _db.AddMember(Member, 1);
        _db.AddMember(OtherMember, 1);
        _db.AddMember(OtherGymMember, 2);
        using (var seed = _db.Create(null))
        {
            var tp = new TrainerProfile { TenantId = 1, UserId = Trainer, BranchId = 11, DisplayName = "Coach Tom" };
            var tp2 = new TrainerProfile { TenantId = 1, UserId = OtherTrainer, BranchId = 11, DisplayName = "Coach Tia" };
            seed.TrainerProfiles.AddRange(tp, tp2);
            seed.SaveChanges();
            _profile = tp.Id;
            _otherProfile = tp2.Id;
        }
    }

    public void Dispose() => _db.Dispose();

    private static User User(ulong id, ulong tenant, ulong role, string name) => new()
    {
        Id = id, TenantId = tenant, RoleId = role, Uuid = Guid.NewGuid().ToString(), Email = $"u{id}@test.local",
        FirstName = name, LastName = "Staff", Status = UserStatus.Active,
    };

    private static FakeUser AsMember(ulong id = Member, ulong tenant = 1) => new() { UserId = id, Role = "client", TenantId = tenant };
    private static FakeUser AsTrainer(ulong id = Trainer) => new() { UserId = id, Role = "trainer", TenantId = 1 };
    private static FakeUser AsAdmin(ulong id = Admin, ulong tenant = 1) => new() { UserId = id, Role = "admin", TenantId = tenant };
    private static readonly RequestMeta Meta = new("127.0.0.1", "tests");

    private async Task<T> As<T>(FakeUser me, Func<MessagingService, Task<T>> work)
    {
        using var db = _db.Create(me);
        return await work(new MessagingService(db, me, new Notifier(db, me)));
    }

    private void Assign(ulong member = Member, ulong? profile = null, TrainerAssignmentStatus status = TrainerAssignmentStatus.Active)
    {
        using var db = _db.Create(null);
        db.TrainerClientAssignments.Add(new TrainerClientAssignment { TenantId = 1, TrainerId = profile ?? _profile, ClientId = member, BranchId = 11, Status = status });
        db.SaveChanges();
    }

    private void EndAssignments()
    {
        using var db = _db.Create(null);
        foreach (var a in db.TrainerClientAssignments) { a.Status = TrainerAssignmentStatus.Inactive; a.EndedAt = DateTime.UtcNow; }
        db.SaveChanges();
    }

    private void AddPtSession(DateTime startsAt, PtSessionStatus status = PtSessionStatus.Completed)
    {
        using var db = _db.Create(null);
        var type = new PtSessionType { TenantId = 1, TrainerId = _profile, Name = "1:1", DurationMin = 60, Price = 0, Currency = "INR" };
        db.PtSessionTypes.Add(type);
        db.SaveChanges();
        db.PtSessions.Add(new PtSession
        {
            TenantId = 1, SessionTypeId = type.Id, TrainerId = _profile, ClientId = Member, StartsAt = startsAt, EndsAt = startsAt.AddHours(1), Status = status,
        });
        db.SaveChanges();
    }

    private Task<ConversationDetail> OpenAsTrainer(ulong member = Member) => As(AsTrainer(), s => s.OpenAsync(new OpenConversationBody { UserId = member }));

    private Task<DirectMessageDto> Send(FakeUser who, ulong conversation, string text, string? cid = null, string? photo = null) =>
        As(who, s => s.SendAsync(conversation, new SendMessageBody { ClientMessageId = cid ?? Guid.NewGuid().ToString("N"), Body = text, PhotoUrl = photo }));

    private static async Task<string?> BlockCode(Func<Task> act) => (await Assert.ThrowsAsync<RuleException>(act)).Code;

    // ── Relationship ────────────────────────────────────────────────────────

    [Fact]
    public async Task A_thread_needs_an_active_relationship_and_turns_read_only_when_it_ends()
    {
        Assert.Equal("MESSAGING_NO_RELATIONSHIP", await BlockCode(() => OpenAsTrainer()));
        Assert.Equal("MESSAGING_NO_RELATIONSHIP", await BlockCode(() => As(AsMember(), s => s.OpenAsync(new OpenConversationBody { UserId = Trainer }))));

        Assign();
        var c = await OpenAsTrainer();
        Assert.True(c.CanSend);
        Assert.Equal(MessagingRules.ReviewNotice, c.ReviewNotice);
        await Send(AsTrainer(), c.Id, "Great session today!");
        // The member sees the same single thread (one per pair).
        var fromMember = await As(AsMember(), s => s.OpenAsync(new OpenConversationBody { UserId = Trainer }));
        Assert.Equal(c.Id, fromMember.Id);
        Assert.Contains(await As(AsMember(), s => s.ContactsAsync()), x => x.Person.UserId == Trainer && x.ConversationId == c.Id);

        // Another trainer of the gym isn't related to the member.
        Assert.Equal("MESSAGING_NO_RELATIONSHIP", await BlockCode(() => As(AsTrainer(OtherTrainer), s => s.OpenAsync(new OpenConversationBody { UserId = Member }))));

        EndAssignments();
        var after = await As(AsMember(), s => s.ThreadAsync(c.Id, null));
        Assert.False(after.CanSend);
        Assert.Equal(MessagingBlocks.NoRelationship, after.BlockedReason);
        Assert.Contains("read-only", after.BlockedNote);
        Assert.Single(after.Messages);                          // history stays readable
        Assert.Equal("MESSAGING_NO_RELATIONSHIP", await BlockCode(() => Send(AsMember(), c.Id, "Hello?")));
    }

    [Fact]
    public async Task A_pt_session_within_90_days_counts_as_a_relationship_but_cancelled_or_older_ones_do_not()
    {
        AddPtSession(DateTime.UtcNow.AddDays(-120));
        AddPtSession(DateTime.UtcNow.AddDays(10), PtSessionStatus.Cancelled);
        Assert.Equal("MESSAGING_NO_RELATIONSHIP", await BlockCode(() => OpenAsTrainer()));
        AddPtSession(DateTime.UtcNow.AddDays(-80));
        var c = await OpenAsTrainer();
        Assert.True(c.CanSend);
        Assert.Contains(await As(AsTrainer(), s => s.ContactsAsync()), x => x.Person.UserId == Member);
    }

    // ── Safeguarding ────────────────────────────────────────────────────────

    [Fact]
    public async Task Members_under_18_cannot_message_unless_the_gym_allows_it()
    {
        Assign();
        using (var db = _db.Create(null))
        {
            db.Users.Single(u => u.Id == Member).Dob = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(-16);
            db.SaveChanges();
        }
        Assert.Equal("MESSAGING_UNDER_18", await BlockCode(() => OpenAsTrainer()));
        Assert.True(MessagingRules.IsUnder18(new DateOnly(2010, 11, 6), new DateOnly(2028, 11, 5)));
        Assert.False(MessagingRules.IsUnder18(new DateOnly(2010, 11, 5), new DateOnly(2028, 11, 5)));
        Assert.False(MessagingRules.IsUnder18(null, new DateOnly(2028, 11, 5)));

        using (var db = _db.Create(AsAdmin()))
            await MessagingSettingsStore.SaveAsync(db, 1, new MessagingSettings { AllowMembersUnder18 = true });
        Assert.True((await OpenAsTrainer()).CanSend);

        using (var db = _db.Create(AsAdmin()))
            await MessagingSettingsStore.SaveAsync(db, 1, new MessagingSettings { Enabled = false, AllowMembersUnder18 = true });
        var id = (await OpenAsTrainer()).Id;
        var off = await As(AsMember(), s => s.ThreadAsync(id, null));
        Assert.Equal(MessagingBlocks.Disabled, off.BlockedReason);
    }

    [Fact]
    public async Task Trainers_cannot_message_members_who_opted_out()
    {
        Assign();
        var c = await OpenAsTrainer();
        Assert.True((await As(AsMember(), s => s.MySettingsAsync())).AllowTrainerMessages); // default on
        await As(AsMember(), s => s.SaveMySettingsAsync(new MyMessagingSettings { AllowTrainerMessages = false }));
        Assert.Equal("MESSAGING_OPTED_OUT", await BlockCode(() => Send(AsTrainer(), c.Id, "Hi")));
        var t = await As(AsTrainer(), s => s.ThreadAsync(c.Id, null));
        Assert.False(t.CanSend);
        Assert.Equal("This member has turned off messages from trainers.", t.BlockedNote);
        await As(AsMember(), s => s.SaveMySettingsAsync(new MyMessagingSettings { AllowTrainerMessages = true }));
        await Send(AsTrainer(), c.Id, "Hi");
    }

    [Fact]
    public async Task Reporting_a_message_raises_a_staff_help_request_once_and_flags_it()
    {
        Assign();
        var c = await OpenAsTrainer();
        var m = await Send(AsTrainer(), c.Id, "Something inappropriate");
        var mine = await Send(AsMember(), c.Id, "My own");
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsMember(), s => s.ReportAsync(mine.Id, new ReportMessageBody())));

        var r = await As(AsMember(), s => s.ReportAsync(m.Id, new ReportMessageBody { Reason = "Made me uncomfortable" }));
        var again = await As(AsMember(), s => s.ReportAsync(m.Id, new ReportMessageBody { Reason = "again" }));
        Assert.Equal(r.SupportRequestId, again.SupportRequestId);

        using var check = _db.Create(null);
        var req = check.SupportRequests.Include(x => x.Messages).Single();
        Assert.Equal(SupportCategories.Staff, req.Category);
        Assert.Equal(SupportPriorities.High, req.Priority);
        Assert.Contains($"conversation #{c.Id}", req.Messages.Single().Body);
        Assert.NotNull(check.DirectMessages.Single(x => x.Id == m.Id).ReportedAt);
        Assert.True(check.Notifications.Any(n => n.UserId == Admin));
        // Trainer-side view doesn't show the member's report; the member's does.
        Assert.True((await As(AsMember(), s => s.ThreadAsync(c.Id, null))).Messages.Single(x => x.Id == m.Id).Reported);
    }

    // ── Sending ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Send_is_idempotent_per_client_message_id_and_validates_input()
    {
        Assign();
        var c = await OpenAsTrainer();
        var first = await Send(AsTrainer(), c.Id, "Hello", cid: "abc-123");
        var retry = await Send(AsTrainer(), c.Id, "Hello", cid: "abc-123");
        Assert.Equal(first.Id, retry.Id);
        using (var check = _db.Create(null)) Assert.Equal(1, check.DirectMessages.Count());

        await Assert.ThrowsAsync<ArgumentException>(() => Send(AsTrainer(), c.Id, "x", cid: ""));
        await Assert.ThrowsAsync<ArgumentException>(() => Send(AsTrainer(), c.Id, new string('a', 2001)));
        await Assert.ThrowsAsync<ArgumentException>(() => Send(AsTrainer(), c.Id, "  "));
        await Assert.ThrowsAsync<ArgumentException>(() => Send(AsTrainer(), c.Id, "pic", photo: "https://evil.example/x.jpg"));
        var withPhoto = await Send(AsMember(), c.Id, "", photo: Photo);
        Assert.Equal(Photo, withPhoto.PhotoUrl);
        Assert.Equal("Photo", (await As(AsTrainer(), s => s.ListAsync())).Single().LastMessage);
        // Members can't attach workouts.
        await Assert.ThrowsAsync<ArgumentException>(() => As(AsMember(), s => s.SendAsync(c.Id,
            new SendMessageBody { ClientMessageId = "m1", Body = "see", AttachmentType = "workout", AttachmentId = 1 })));
    }

    [Fact]
    public async Task Unread_counts_and_read_receipts_follow_who_opened_the_thread()
    {
        Assign();
        var c = await OpenAsTrainer();
        Assert.Empty(await As(AsMember(), s => s.ListAsync()));       // no messages yet: not in the inbox
        await Send(AsTrainer(), c.Id, "One");
        await Send(AsTrainer(), c.Id, "Two");

        var inbox = Assert.Single(await As(AsMember(), s => s.ListAsync()));
        Assert.Equal(2, inbox.Unread);
        Assert.Equal("Coach Tom", inbox.Other.Name);
        Assert.Equal(2, (await As(AsMember(), s => s.UnreadAsync())).Total);
        Assert.Equal(0, (await As(AsTrainer(), s => s.UnreadAsync())).Total);       // own messages never count
        Assert.Null((await As(AsTrainer(), s => s.ThreadAsync(c.Id, null))).OtherLastReadAt);

        var thread = await As(AsMember(), s => s.ThreadAsync(c.Id, null));   // opening marks it read
        Assert.Equal(["One", "Two"], thread.Messages.Select(m => m.Body));
        Assert.Equal(0, (await As(AsMember(), s => s.UnreadAsync())).Total);
        Assert.NotNull((await As(AsTrainer(), s => s.ThreadAsync(c.Id, null))).OtherLastReadAt);

        await Send(AsMember(), c.Id, "Thanks!");
        Assert.Equal(1, Assert.Single(await As(AsTrainer(), s => s.ListAsync())).Unread);
    }

    [Fact]
    public async Task Sending_is_limited_to_30_messages_per_minute()
    {
        Assign();
        var c = await OpenAsTrainer();
        using (var db = _db.Create(null))
        {
            for (var i = 0; i < MessagingRules.RateLimitPerMinute; i++)
                db.DirectMessages.Add(new DirectMessage { TenantId = 1, ConversationId = c.Id, SenderId = Member, ClientMessageId = $"seed-{i}", Body = "spam", CreatedAt = DateTime.UtcNow.AddSeconds(-10) });
            db.SaveChanges();
        }
        var ex = await Assert.ThrowsAsync<RuleException>(() => Send(AsMember(), c.Id, "one more"));
        Assert.Equal(429, ex.StatusCode);
        Assert.Equal("MESSAGE_RATE_LIMITED", ex.Code);
        // A retry of an already-stored message is not a new send.
        Assert.Equal("spam", (await Send(AsMember(), c.Id, "spam", cid: "seed-3")).Body);
        // The trainer has their own allowance.
        await Send(AsTrainer(), c.Id, "Slow down :)");
    }

    // ── Push ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task One_notification_per_thread_per_5_minutes_none_while_muted_and_it_opens_the_thread()
    {
        Assign();
        var c = await OpenAsTrainer();
        await Send(AsTrainer(), c.Id, "One");
        await Send(AsTrainer(), c.Id, "Two");
        await Send(AsTrainer(), c.Id, "Three");
        using (var db = _db.Create(null))
        {
            var pushes = db.CommunicationLogs.Where(l => l.UserId == Member && l.Channel == CommunicationChannel.Push).ToList();
            var push = Assert.Single(pushes);
            Assert.StartsWith(MessagingRules.PushKeyPrefix(c.Id, Member), push.ProviderRef);
            var meta = PushMeta.From(push.Meta);
            Assert.Equal(NotificationCategories.Messages, meta.Category);
            Assert.False(meta.Urgent);
            Assert.Equal($"message-thread/{c.Id}", meta.Route);
            Assert.Single(db.Notifications.Where(n => n.UserId == Member));
            push.CreatedAt = DateTime.UtcNow.AddMinutes(-6);   // the window has passed
            db.SaveChanges();
        }
        await Send(AsTrainer(), c.Id, "Four");
        using (var db = _db.Create(null))
            Assert.Equal(2, db.CommunicationLogs.Count(l => l.UserId == Member && l.Channel == CommunicationChannel.Push));

        // The trainer gets their own (separate key); a muted member gets none.
        await Send(AsMember(), c.Id, "Reply");
        await As(AsMember(), s => s.MuteAsync(c.Id, true));
        using (var db = _db.Create(null))
        {
            foreach (var l in db.CommunicationLogs) l.CreatedAt = DateTime.UtcNow.AddMinutes(-10);
            db.SaveChanges();
        }
        await Send(AsTrainer(), c.Id, "Five");
        using (var check = _db.Create(null))
        {
            Assert.Equal(2, check.CommunicationLogs.Count(l => l.UserId == Member && l.Channel == CommunicationChannel.Push));
            Assert.Equal(1, check.CommunicationLogs.Count(l => l.UserId == Trainer && l.Channel == CommunicationChannel.Push));
        }
        Assert.Equal($"message-thread/{c.Id}", PushRoutes.For(MessagingRules.Kind, c.Id));
    }

    [Fact]
    public void Messages_category_defaults_to_push_on_and_email_off()
    {
        Assert.Contains(NotificationCategories.Messages, NotificationCategories.All);
        Assert.True(NotificationPolicy.Allows(null, NotificationCategories.Messages, NotificationChannels.Push));
        Assert.False(NotificationPolicy.Allows(null, NotificationCategories.Messages, NotificationChannels.Email));
        Assert.Equal(NotificationCategories.Messages, NotificationCategories.ForKind("message"));
        var off = JsonDocument.Parse("""{"messages":{"push":false,"email":true}}""");
        Assert.False(NotificationPolicy.Allows(off, NotificationCategories.Messages, NotificationChannels.Push));
    }

    // ── Admin review & isolation ────────────────────────────────────────────

    [Fact]
    public async Task Admin_review_is_read_only_audited_and_searchable()
    {
        Assign();
        var c = await OpenAsTrainer();
        var m = await Send(AsTrainer(), c.Id, "Hello there");
        await As(AsMember(), s => s.ReportAsync(m.Id, new ReportMessageBody()));

        using (var db = _db.Create(AsAdmin()))
        {
            var review = new MessagingReviewService(db, AsAdmin());
            Assert.Single(await review.ListAsync("tom", false, Meta));
            Assert.Single(await review.ListAsync("member 100", false, Meta));
            Assert.Empty(await review.ListAsync("nobody", false, Meta));
            Assert.Equal(1, Assert.Single(await review.ListAsync(null, true, Meta)).ReportedCount);
            var thread = await review.ThreadAsync(c.Id, Meta);
            Assert.Equal("Coach Tom", thread.Messages.Single().SenderName);
            Assert.True(thread.Messages.Single().Reported);
        }
        using (var check = _db.Create(null))
        {
            var audit = check.AuditLogs.Single(a => a.Action == "messages.review_view");
            Assert.Equal(Admin, audit.UserId);
            Assert.Equal(c.Id, audit.EntityId);
            Assert.Equal(MessagingReviewService.AuditEntity, audit.EntityType);
            Assert.Equal(4, check.AuditLogs.Count(a => a.Action == "messages.review_list"));
        }

        // The module is admin-only by default and never part of a role template.
        Assert.DoesNotContain(Application.Access.RoleTemplates.All.Single(t => t.Key == "manager").Grants, g => g.ModuleKey == MessagingReviewService.ModuleKey);
        Assert.Contains(MessagingReviewService.ModuleKey, Application.Access.ModuleCatalog.DefaultKeysFor("admin"));
    }

    [Fact]
    public async Task Other_gyms_and_other_people_cannot_see_a_thread()
    {
        Assign();
        var c = await OpenAsTrainer();
        await Send(AsTrainer(), c.Id, "Private");

        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherMember), s => s.ThreadAsync(c.Id, null)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsTrainer(OtherTrainer), s => s.ThreadAsync(c.Id, null)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherGymMember, 2), s => s.ThreadAsync(c.Id, null)));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => As(AsMember(OtherGymMember, 2), s => s.SendAsync(c.Id, new SendMessageBody { ClientMessageId = "x1", Body = "hi" })));
        // A trainer can't open a thread with another gym's member.
        await Assert.ThrowsAsync<KeyNotFoundException>(() => OpenAsTrainer(OtherGymMember));
        // Admins and staff aren't participants.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => As(AsAdmin(), s => s.ListAsync()));
        using (var db = _db.Create(AsAdmin(OtherGymAdmin, 2)))
        {
            var review = new MessagingReviewService(db, AsAdmin(OtherGymAdmin, 2));
            Assert.Empty(await review.ListAsync(null, false, Meta));
            await Assert.ThrowsAsync<KeyNotFoundException>(() => review.ThreadAsync(c.Id, Meta));
        }
    }

    // ── Privacy ─────────────────────────────────────────────────────────────

    private static PrivacyProcessor Processor(AppDbContext db, NullStorage storage) =>
        new(db, storage, new EmailOutbox(db), new Notifier(db, new FakeUser { UserId = null, IsAuthenticated = false }), NullLogger<PrivacyProcessor>.Instance);

    [Fact]
    public async Task Privacy_export_has_both_sides_of_the_members_threads_and_anonymisation_redacts_only_theirs()
    {
        Assign();
        Assign(OtherMember);
        var c = await OpenAsTrainer();
        await Send(AsTrainer(), c.Id, "How did the squats feel?");
        await Send(AsMember(), c.Id, "My knee hurt a bit", photo: Photo);
        var other = await OpenAsTrainer(OtherMember);
        await Send(AsTrainer(), other.Id, "Someone else's thread");

        using (var pdb = _db.Create(null))
        {
            var zip = await Processor(pdb, new NullStorage()).BuildExportZipAsync(1, Member, DateTime.UtcNow);
            using var archive = new ZipArchive(new MemoryStream(zip));
            using var json = JsonDocument.Parse(archive.GetEntry("data.json")!.Open());
            var threads = json.RootElement.GetProperty("sections").GetProperty("messages");
            Assert.Equal(1, threads.GetArrayLength());
            var msgs = threads[0].GetProperty("messages");
            Assert.Equal(2, msgs.GetArrayLength());
            Assert.Equal("trainer", msgs[0].GetProperty("from").GetString());
            Assert.Equal("you", msgs[1].GetProperty("from").GetString());
            Assert.DoesNotContain("Someone else", json.RootElement.GetRawText());
        }

        var storage = new NullStorage();
        using (var db = _db.Create(null))
        {
            var request = new AccountDeletionRequest { TenantId = 1, UserId = Member, RequestedByUserId = Member, ScheduledFor = DateTime.UtcNow.AddDays(-1) };
            db.AccountDeletionRequests.Add(request);
            await db.SaveChangesAsync();
            Assert.True(await Processor(db, storage).ExecuteAsync(request, null, DateTime.UtcNow));
        }
        using var check = _db.Create(null);
        var rows = check.DirectMessages.Where(m => m.ConversationId == c.Id).OrderBy(m => m.CreatedAt).ToList();
        Assert.Equal("How did the squats feel?", rows[0].Body);         // the trainer's message stays
        Assert.Equal(MessagingRules.RedactedText, rows[1].Body);
        Assert.Null(rows[1].PhotoUrl);
        Assert.NotNull(rows[1].RedactedAt);
        Assert.Contains(Photo, storage.Deleted);
        var thread = check.Conversations.Single(x => x.Id == c.Id);   // the thread row stays
        Assert.NotNull(thread.MemberRedactedAt);
        Assert.Equal(MessagingRules.RedactedText, thread.LastMessagePreview);
        Assert.Equal("Someone else's thread", check.DirectMessages.Single(m => m.ConversationId == other.Id).Body);
    }

    [Fact]
    public void Working_hours_wrap_midnight_and_previews_are_short()
    {
        Assert.True(MessagingRules.InWorkingHours(new TimeOnly(9, 0), new TimeOnly(8, 0), new TimeOnly(20, 0)));
        Assert.False(MessagingRules.InWorkingHours(new TimeOnly(21, 0), new TimeOnly(8, 0), new TimeOnly(20, 0)));
        Assert.True(MessagingRules.InWorkingHours(new TimeOnly(23, 0), new TimeOnly(22, 0), new TimeOnly(6, 0)));
        Assert.Equal("Shared: Leg day", MessagingRules.Preview("", false, "Leg day"));
        Assert.Equal(118, MessagingRules.Preview(new string('a', 500), false, null).Length);
        Assert.Throws<ArgumentException>(() => new MessagingSettings { WorkingHoursStart = "25:00" }.Validate());
    }

    private sealed class NullStorage : IFileStorage
    {
        public readonly List<string> Deleted = [];
        public Task<string> SaveAsync(FileUpload file, string folder, FileKind kind) => Task.FromResult($"https://store/authenticated/{folder}/{Guid.NewGuid():N}.zip");
        public Task DeleteAsync(string? url) { if (url is not null) Deleted.Add(url); return Task.CompletedTask; }
        public Task<string> GetSignedUrlAsync(string url) => Task.FromResult(url);
    }
}
