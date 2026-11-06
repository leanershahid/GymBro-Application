using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Support;
using GymManagmentApplication.Domain.Entities.Communication;
using GymManagmentApplication.Domain.Entities.Messaging;
using GymManagmentApplication.Domain.Entities.Support;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Messaging;

/// <summary>
/// One-to-one messaging between trainers and their members (roadmap feature 8). The caller is
/// either side: a trainer (role trainer) or a member (role client); everyone else is refused.
/// <list type="bullet">
/// <item>One <see cref="Conversation"/> per (trainer, member) pair per gym, created when either
/// side opens it from a contact (or sends the first message).</item>
/// <item>New messages need all of: messaging enabled at the gym; the member is 18+ (or the gym allows
/// under-18s); the member hasn't turned off "Allow my trainer to message me"; and an active
/// relationship — the trainer is actively assigned to the member (the same rule as health
/// visibility, <see cref="MemberScope.AssignedClientIds"/>) or they have a PT session within
/// 90 days either side of now. Otherwise the thread stays readable but read-only, with a note.</item>
/// <item>Sends are idempotent per (sender, clientMessageId) and limited to 30 per minute per user.</item>
/// <item>The recipient gets a <c>messages</c>-category notification (quiet hours apply, not
/// urgent), at most one per thread per 5 minutes, none while they muted the thread.</item>
/// </list>
/// </summary>
public class MessagingService(IAppDbContext db, ICurrentUser currentUser, Notifier notifier)
{
    public const string TrainerSide = "trainer";
    public const string MemberSide = "member";
    private const int PageSize = 50;

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    /// <summary>The caller's side; anyone but a trainer or a member is refused.</summary>
    private bool IAmTrainer =>
        currentUser.IsTrainer() ? true
        : currentUser.IsClient() ? false
        : throw new UnauthorizedAccessException("Messages are for trainers and their members.");

    // ═════════════════════════════ Inbox ═════════════════════════════

    public async Task<List<ConversationSummary>> ListAsync()
    {
        var me = Me;
        var trainer = IAmTrainer;
        var rows = await Mine(trainer, me).AsNoTracking().Where(c => c.LastMessageAt != null)
            .OrderByDescending(c => c.LastMessageAt).Take(200).ToListAsync();
        var unread = await UnreadByConversationAsync(trainer, me, rows.Select(r => r.Id).ToList());
        var people = await PeopleAsync(rows.Select(r => trainer ? r.MemberUserId : r.TrainerUserId));
        return rows.Select(c => new ConversationSummary
        {
            Id = c.Id,
            Other = people.GetValueOrDefault(trainer ? c.MemberUserId : c.TrainerUserId) ?? Unknown(trainer ? c.MemberUserId : c.TrainerUserId, !trainer),
            LastMessage = c.LastMessagePreview, LastMessageAt = c.LastMessageAt, LastMessageMine = c.LastMessageSenderId == me,
            Unread = unread.GetValueOrDefault(c.Id), Muted = trainer ? c.TrainerMuted : c.MemberMuted,
        }).ToList();
    }

    public async Task<UnreadMessagesResponse> UnreadAsync()
    {
        var me = Me;
        var trainer = IAmTrainer;
        var ids = await Mine(trainer, me).Where(c => c.LastMessageAt != null).Select(c => c.Id).ToListAsync();
        var unread = await UnreadByConversationAsync(trainer, me, ids);
        return new UnreadMessagesResponse { Total = unread.Values.Sum(), Conversations = unread.Count(u => u.Value > 0) };
    }

    /// <summary>People the caller can start a thread with right now (member: their trainers; trainer: their clients).</summary>
    public async Task<List<MessageContact>> ContactsAsync()
    {
        var me = Me;
        var trainer = IAmTrainer;
        var tenantId = TenantId;
        var now = DateTime.UtcNow;
        var (winFrom, winTo) = (now.AddDays(-MessagingRules.RelationshipWindowDays), now.AddDays(MessagingRules.RelationshipWindowDays));
        List<ulong> ids;
        if (trainer)
        {
            var profiles = MyProfileIds(me);
            var assigned = await db.AssignedClientIds(me).ToListAsync();
            var pt = await db.PtSessions.Where(p => p.TenantId == tenantId && profiles.Contains(p.TrainerId) && p.Status != PtSessionStatus.Cancelled
                                                    && p.StartsAt >= winFrom && p.StartsAt <= winTo).Select(p => p.ClientId).ToListAsync();
            ids = assigned.Concat(pt).Distinct().ToList();
        }
        else
        {
            var assigned = await (from a in db.TrainerClientAssignments
                                  join t in db.TrainerProfiles on a.TrainerId equals t.Id
                                  where a.ClientId == me && a.Status == TrainerAssignmentStatus.Active && t.UserId != null
                                  select t.UserId!.Value).ToListAsync();
            var pt = await (from p in db.PtSessions
                            join t in db.TrainerProfiles on p.TrainerId equals t.Id
                            where p.TenantId == tenantId && p.ClientId == me && p.Status != PtSessionStatus.Cancelled
                                  && p.StartsAt >= winFrom && p.StartsAt <= winTo && t.UserId != null
                            select t.UserId!.Value).ToListAsync();
            ids = assigned.Concat(pt).Distinct().ToList();
        }
        ids.Remove(me);
        var people = await PeopleAsync(ids);
        var existing = await Mine(trainer, me).Select(c => new { c.Id, Other = trainer ? c.MemberUserId : c.TrainerUserId }).ToListAsync();
        return ids.Where(people.ContainsKey).Select(id => new MessageContact
        {
            Person = people[id], ConversationId = existing.FirstOrDefault(e => e.Other == id)?.Id,
        }).OrderBy(c => c.Person.Name).ToList();
    }

    // ═════════════════════════════ Thread ═════════════════════════════

    /// <summary>
    /// Opens the thread with <paramref name="body"/>.UserId: the existing one (whatever its state), or a
    /// new one when messaging is allowed between them right now.
    /// </summary>
    public async Task<ConversationDetail> OpenAsync(OpenConversationBody body)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var tenantId = TenantId;
        var other = body.UserId;
        if (other == 0 || other == me) throw new ArgumentException("Pick who to message.");
        var (trainerId, memberId) = trainer ? (me, other) : (other, me);

        var existing = await db.Conversations.FirstOrDefaultAsync(c => c.TrainerUserId == trainerId && c.MemberUserId == memberId);
        if (existing is not null) return await ThreadAsync(existing.Id, null);

        // The other person must be the right kind of account in this gym.
        if (trainer && !await IsMemberAsync(memberId)) throw new KeyNotFoundException("Member not found.");
        if (!trainer && !await db.TrainerProfiles.AnyAsync(t => t.UserId == trainerId)) throw new KeyNotFoundException("Trainer not found.");

        var block = await BlockAsync(tenantId, trainerId, memberId, DateTime.UtcNow);
        if (block is not null) throw Blocked(block, trainer);

        var c = new Conversation { TenantId = tenantId, TrainerUserId = trainerId, MemberUserId = memberId };
        db.Conversations.Add(c);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // Both opened it at once: the unique (tenant, trainer, member) index kept one.
            db.ChangeTracker.Clear();
            c = await db.Conversations.FirstOrDefaultAsync(x => x.TrainerUserId == trainerId && x.MemberUserId == memberId) ?? throw new InvalidOperationException("Could not open the conversation.");
        }
        return await ThreadAsync(c.Id, null);
    }

    /// <summary>The thread, newest <see cref="PageSize"/> messages (or those before <paramref name="before"/>); marks it read for the caller.</summary>
    public async Task<ConversationDetail> ThreadAsync(ulong id, ulong? before)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var tenantId = TenantId;
        var c = await Mine(trainer, me).FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Conversation not found.");

        var q = db.DirectMessages.AsNoTracking().Where(m => m.ConversationId == id);
        if (before is { } b)
        {
            // Cursor = the oldest message the app has; older ones are those sent before it.
            var at = await db.DirectMessages.Where(m => m.Id == b && m.ConversationId == id).Select(m => (DateTime?)m.CreatedAt).FirstOrDefaultAsync();
            if (at is { } cursor) q = q.Where(m => m.CreatedAt < cursor);
        }
        var page = await q.OrderByDescending(m => m.CreatedAt).Take(PageSize + 1).ToListAsync();
        var hasMore = page.Count > PageSize;
        var messages = page.Take(PageSize).OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).ToList();

        // Read receipt: only when something new arrived (polling every 10 s doesn't write each time).
        var now = DateTime.UtcNow;
        var myRead = trainer ? c.TrainerLastReadAt : c.MemberLastReadAt;
        if (before is null && c.LastMessageAt is { } last && (myRead is null || myRead < last))
        {
            if (trainer) c.TrainerLastReadAt = now; else c.MemberLastReadAt = now;
            await db.SaveChangesAsync();
        }

        var otherId = trainer ? c.MemberUserId : c.TrainerUserId;
        var people = await PeopleAsync([otherId]);
        var settings = await MessagingSettingsStore.LoadAsync(db, tenantId);
        var block = await BlockAsync(tenantId, c.TrainerUserId, c.MemberUserId, now, settings);
        return new ConversationDetail
        {
            Id = c.Id, Other = people.GetValueOrDefault(otherId) ?? Unknown(otherId, !trainer), MySide = trainer ? TrainerSide : MemberSide,
            CanSend = block is null, BlockedReason = block, BlockedNote = block is null ? null : Note(block, trainer),
            CanAttach = trainer && block is null, Muted = trainer ? c.TrainerMuted : c.MemberMuted,
            HoursNotice = trainer ? null : await HoursNoticeAsync(settings, tenantId, now),
            OtherLastReadAt = trainer ? c.MemberLastReadAt : c.TrainerLastReadAt,
            Messages = messages.Select(m => Map(m, me)).ToList(), HasMore = hasMore,
        };
    }

    public async Task<DirectMessageDto> SendAsync(ulong conversationId, SendMessageBody body)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var tenantId = TenantId;
        var cid = body.ClientMessageId?.Trim();
        if (!MessagingRules.ValidClientMessageId(cid)) throw new ArgumentException("clientMessageId is required (up to 64 letters, digits, - or _).");

        // A retry of a message that already went through: return it (no second copy, no second push).
        var dup = await db.DirectMessages.AsNoTracking().FirstOrDefaultAsync(m => m.SenderId == me && m.ClientMessageId == cid);
        if (dup is not null)
            return dup.ConversationId == conversationId ? Map(dup, me) : throw RuleException.Conflict("That message id was already used in another conversation.");

        var c = await Mine(trainer, me).FirstOrDefaultAsync(x => x.Id == conversationId) ?? throw new KeyNotFoundException("Conversation not found.");

        var text = (body.Body ?? "").Trim();
        if (text.Length > MessagingRules.MaxBodyLength) throw new ArgumentException($"Messages can be up to {MessagingRules.MaxBodyLength} characters.");
        string? photo = null;
        if (!string.IsNullOrWhiteSpace(body.PhotoUrl))
        {
            photo = body.PhotoUrl.Trim();
            SupportCommon.Photos([photo], tenantId); // same check as help requests: http(s), this gym's upload folder
        }
        var attachment = await AttachmentAsync(trainer, me, c.MemberUserId, body.AttachmentType, body.AttachmentId);
        if (text.Length == 0 && photo is null && attachment is null) throw new ArgumentException("Write a message.");

        var now = DateTime.UtcNow;
        var block = await BlockAsync(tenantId, c.TrainerUserId, c.MemberUserId, now);
        if (block is not null) throw Blocked(block, trainer);

        var lastMinute = now.AddMinutes(-1);
        if (await db.DirectMessages.CountAsync(m => m.SenderId == me && m.CreatedAt > lastMinute) >= MessagingRules.RateLimitPerMinute)
            throw new RuleException("You're sending messages very fast. Please wait a moment and try again.", 429) { Code = "MESSAGE_RATE_LIMITED" };

        var m = new DirectMessage
        {
            TenantId = tenantId, ConversationId = c.Id, SenderId = me, ClientMessageId = cid!, Body = text, PhotoUrl = photo,
            AttachmentType = attachment?.Type, AttachmentId = attachment?.Id, AttachmentTargetId = attachment?.TargetId, AttachmentTitle = attachment?.Title,
            CreatedAt = now, UpdatedAt = now,
        };
        db.DirectMessages.Add(m);
        c.LastMessageAt = now;
        c.LastMessagePreview = MessagingRules.Preview(text, photo is not null, attachment?.Title);
        c.LastMessageSenderId = me;
        if (trainer) c.TrainerLastReadAt = now; else c.MemberLastReadAt = now;
        await NotifyAsync(c, trainer, me, c.LastMessagePreview, now);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException)
        {
            // The same clientMessageId raced in from a double tap: the unique index kept the first one.
            db.ChangeTracker.Clear();
            var first = await db.DirectMessages.AsNoTracking().FirstOrDefaultAsync(x => x.SenderId == me && x.ClientMessageId == cid);
            if (first is null) throw;
            return Map(first, me);
        }
        return Map(m, me);
    }

    public async Task MarkReadAsync(ulong id)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var c = await Mine(trainer, me).FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Conversation not found.");
        if (trainer) c.TrainerLastReadAt = DateTime.UtcNow; else c.MemberLastReadAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }

    /// <summary>Mute: no notifications for this thread (messages still arrive in the inbox).</summary>
    public async Task<bool> MuteAsync(ulong id, bool muted)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var c = await Mine(trainer, me).FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Conversation not found.");
        if (trainer) c.TrainerMuted = muted; else c.MemberMuted = muted;
        await db.SaveChangesAsync();
        return muted;
    }

    /// <summary>Workouts and plans the calling trainer assigned to this thread's member (for the attach sheet).</summary>
    public async Task<List<MessageAttachmentDto>> AttachablesAsync(ulong id)
    {
        var me = Me;
        if (!IAmTrainer) throw new UnauthorizedAccessException("Only trainers can share workouts and plans.");
        var c = await Mine(true, me).AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Conversation not found.");
        var profiles = MyProfileIds(me);
        var workouts = await db.WorkoutAssignments.Where(w => w.ClientId == c.MemberUserId && w.TrainerId != null && profiles.Contains(w.TrainerId.Value))
            .OrderByDescending(w => w.CreatedAt).Take(30)
            .Select(w => new MessageAttachmentDto { Type = MessageAttachmentTypes.Workout, Id = w.Id, TargetId = w.TemplateId, Title = w.Template.Name }).ToListAsync();
        var plans = await db.WorkoutPlanAssignments.Where(p => p.ClientId == c.MemberUserId && p.TrainerId != null && profiles.Contains(p.TrainerId.Value))
            .OrderByDescending(p => p.CreatedAt).Take(30)
            .Select(p => new MessageAttachmentDto { Type = MessageAttachmentTypes.Plan, Id = p.Id, TargetId = p.PlanId, Title = p.Plan.Name }).ToListAsync();
        return plans.Concat(workouts).ToList();
    }

    // ═════════════════════════════ Safeguarding ═════════════════════════════

    /// <summary>
    /// Reports the other participant's message to the gym: raises a "Staff &amp; trainers" help
    /// request (priority high) for the staff queue, as feature 6's requests are, and flags the message.
    /// Reporting the same message again returns the first report.
    /// </summary>
    public async Task<ReportMessageResult> ReportAsync(ulong messageId, ReportMessageBody body)
    {
        var me = Me;
        var trainer = IAmTrainer;
        var tenantId = TenantId;
        var reason = SupportCommon.Clean(body.Reason, 1000);
        return await db.InTransactionAsync(async () =>
        {
            await db.LockRowAsync<DirectMessage>(messageId);
            var m = await db.DirectMessages.Include(x => x.Conversation).FirstOrDefaultAsync(x => x.Id == messageId)
                    ?? throw new KeyNotFoundException("Message not found.");
            var c = m.Conversation;
            if (c.TrainerUserId != me && c.MemberUserId != me) throw new KeyNotFoundException("Message not found.");
            if (m.SenderId == me) throw new ArgumentException("You can only report messages you received.");
            if (m.ReportedAt is not null) return new ReportMessageResult { MessageId = m.Id, SupportRequestId = m.ReportRequestId };

            var now = DateTime.UtcNow;
            var people = await PeopleAsync([me, m.SenderId]);
            var reporter = people.GetValueOrDefault(me)?.Name ?? "A participant";
            var sender = people.GetValueOrDefault(m.SenderId)?.Name ?? "the other participant";
            var excerpt = MessagingRules.Preview(m.Body, m.PhotoUrl is not null, m.AttachmentTitle);
            var text = $"{reporter} ({(trainer ? "trainer" : "member")}) reported a message from {sender} in conversation #{c.Id}. " +
                       $"Open it in Messages review to read the thread.\n\nReason: {reason ?? "(none given)"}\n\nMessage: \"{excerpt}\"";
            var request = new SupportRequest
            {
                TenantId = tenantId, UserId = me, Category = SupportCategories.Staff, Subject = "Reported message",
                Status = SupportStatuses.Open, Priority = SupportPriorities.High, CanContact = true, ContactMethod = "app",
                LastMessageAt = now, LastMessageBy = SupportAuthorRoles.Member, CreatedAt = now, UpdatedAt = now,
            };
            request.Messages.Add(new SupportMessage
            {
                TenantId = tenantId, AuthorId = me, AuthorRole = SupportAuthorRoles.Member, Kind = SupportMessageKinds.Message,
                Body = text.Length > 4000 ? text[..4000] : text, CreatedAt = now, UpdatedAt = now,
            });
            db.SupportRequests.Add(request);
            await db.SaveChangesAsync();

            m.ReportedAt = now;
            m.ReportedById = me;
            m.ReportRequestId = request.Id;
            foreach (var staff in await SupportCommon.StaffRecipientsAsync(db, tenantId))
                notifier.Add(tenantId, staff, "A message was reported", $"{reporter} reported a message from {sender}.", SupportCommon.StaffKind, request.Id);
            await db.SaveChangesAsync();
            return new ReportMessageResult { MessageId = m.Id, SupportRequestId = request.Id };
        });
    }

    public async Task<MyMessagingSettings> MySettingsAsync()
    {
        var me = Me;
        var row = await db.MessagingUserSettings.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == me);
        return new MyMessagingSettings { AllowTrainerMessages = row?.AllowTrainerMessages ?? true };
    }

    public async Task<MyMessagingSettings> SaveMySettingsAsync(MyMessagingSettings body)
    {
        var me = Me;
        if (IAmTrainer) throw new UnauthorizedAccessException("This setting is for members.");
        var row = await db.MessagingUserSettings.FirstOrDefaultAsync(s => s.UserId == me);
        if (row is null) db.MessagingUserSettings.Add(row = new MessagingUserSetting { TenantId = TenantId, UserId = me });
        row.AllowTrainerMessages = body.AllowTrainerMessages;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return new MyMessagingSettings { AllowTrainerMessages = row.AllowTrainerMessages };
    }

    // ═════════════════════════════ Rules ═════════════════════════════

    /// <summary>Null when the pair may message now, otherwise the <see cref="MessagingBlocks"/> reason.</summary>
    public async Task<string?> BlockAsync(ulong tenantId, ulong trainerUserId, ulong memberUserId, DateTime now, MessagingSettings? settings = null)
    {
        settings ??= await MessagingSettingsStore.LoadAsync(db, tenantId);
        if (!settings.Enabled) return MessagingBlocks.Disabled;
        if (!settings.AllowMembersUnder18)
        {
            var dob = await db.Users.Where(u => u.Id == memberUserId).Select(u => u.Dob).FirstOrDefaultAsync();
            var clock = await TenantClock.ForAsync(db, tenantId);
            if (MessagingRules.IsUnder18(dob, DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), clock.Zone))))
                return MessagingBlocks.Under18;
        }
        if (await db.MessagingUserSettings.AnyAsync(s => s.UserId == memberUserId && !s.AllowTrainerMessages)) return MessagingBlocks.OptedOut;
        if (!await HasRelationshipAsync(tenantId, trainerUserId, memberUserId, now)) return MessagingBlocks.NoRelationship;
        return null;
    }

    /// <summary>Actively assigned trainer, or a (not cancelled) PT session within 90 days either side of <paramref name="now"/>.</summary>
    public async Task<bool> HasRelationshipAsync(ulong tenantId, ulong trainerUserId, ulong memberUserId, DateTime now)
    {
        if (await db.AssignedClientIds(trainerUserId).AnyAsync(id => id == memberUserId)) return true;
        var profiles = MyProfileIds(trainerUserId);
        var (winFrom, winTo) = (now.AddDays(-MessagingRules.RelationshipWindowDays), now.AddDays(MessagingRules.RelationshipWindowDays));
        return await db.PtSessions.AnyAsync(p => p.TenantId == tenantId && p.ClientId == memberUserId && profiles.Contains(p.TrainerId)
                                                 && p.Status != PtSessionStatus.Cancelled && p.StartsAt >= winFrom && p.StartsAt <= winTo);
    }

    public static string Note(string block, bool viewerIsTrainer) => block switch
    {
        MessagingBlocks.Disabled => "Messaging is turned off at your gym.",
        MessagingBlocks.Under18 => viewerIsTrainer
            ? "Messaging isn't available for members under 18 at this gym."
            : "Messaging with trainers isn't available for members under 18 at this gym.",
        MessagingBlocks.OptedOut => viewerIsTrainer
            ? "This member has turned off messages from trainers."
            : "You've turned off messages from trainers. Turn them back on in Profile → Messages.",
        MessagingBlocks.NoRelationship => viewerIsTrainer
            ? "You're no longer training this member, so this conversation is read-only."
            : "You're no longer training with this coach, so this conversation is read-only.",
        _ => "You can't send messages here right now.",
    };

    private static RuleException Blocked(string block, bool viewerIsTrainer) =>
        new(Note(block, viewerIsTrainer), RuleException.UnprocessableStatus) { Code = "MESSAGING_" + block.ToUpperInvariant() };

    // ═════════════════════════════ Helpers ═════════════════════════════

    private IQueryable<Conversation> Mine(bool trainer, ulong me) =>
        trainer ? db.Conversations.Where(c => c.TrainerUserId == me) : db.Conversations.Where(c => c.MemberUserId == me);

    private IQueryable<ulong> MyProfileIds(ulong trainerUserId) =>
        db.TrainerProfiles.Where(t => t.UserId == trainerUserId).Select(t => t.Id);

    /// <summary>A live client account of the caller's gym (IgnoreQueryFilters drops the tenant filter for the whole query, hence the explicit tenant).</summary>
    private async Task<bool> IsMemberAsync(ulong userId)
    {
        var tenantId = TenantId;
        return await (from u in db.Users.IgnoreQueryFilters()
                      join r in db.Roles.IgnoreQueryFilters() on u.RoleId equals r.Id
                      where u.Id == userId && u.TenantId == tenantId && u.DeletedAt == null && r.Slug == Domain.Constants.RoleNames.Client
                      select u.Id).AnyAsync();
    }

    /// <summary>Messages from the other side newer than the caller's read receipt, per conversation.</summary>
    private async Task<Dictionary<ulong, int>> UnreadByConversationAsync(bool trainer, ulong me, List<ulong> ids)
    {
        if (ids.Count == 0) return [];
        var q = from m in db.DirectMessages
                join c in db.Conversations on m.ConversationId equals c.Id
                where ids.Contains(m.ConversationId) && m.SenderId != me
                select new { m.ConversationId, m.CreatedAt, Read = trainer ? c.TrainerLastReadAt : c.MemberLastReadAt };
        return await q.Where(x => x.Read == null || x.CreatedAt > x.Read)
            .GroupBy(x => x.ConversationId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
    }

    private async Task<(string Type, ulong Id, ulong TargetId, string Title)?> AttachmentAsync(bool trainer, ulong me, ulong memberId, string? type, ulong? id)
    {
        if (string.IsNullOrWhiteSpace(type) && id is null) return null;
        if (!trainer) throw new ArgumentException("Only trainers can share workouts and plans.");
        var t = (type ?? "").Trim().ToLowerInvariant();
        if (id is not { } aid || aid == 0) throw new ArgumentException("Pick the workout or plan to share.");
        var profiles = MyProfileIds(me);
        switch (t)
        {
            case MessageAttachmentTypes.Workout:
            {
                var w = await db.WorkoutAssignments.Where(x => x.Id == aid && x.ClientId == memberId && x.TrainerId != null && profiles.Contains(x.TrainerId.Value))
                    .Select(x => new { x.TemplateId, x.Template.Name }).FirstOrDefaultAsync()
                    ?? throw new ArgumentException("You can share workouts you assigned to this member.");
                return (t, aid, w.TemplateId, Trim(w.Name));
            }
            case MessageAttachmentTypes.Plan:
            {
                var p = await db.WorkoutPlanAssignments.Where(x => x.Id == aid && x.ClientId == memberId && x.TrainerId != null && profiles.Contains(x.TrainerId.Value))
                    .Select(x => new { x.PlanId, x.Plan.Name }).FirstOrDefaultAsync()
                    ?? throw new ArgumentException("You can share plans you assigned to this member.");
                return (t, aid, p.PlanId, Trim(p.Name));
            }
            default: throw new ArgumentException("Attachment: workout or plan.");
        }
        static string Trim(string s) => s.Length > 200 ? s[..200] : s;
    }

    /// <summary>
    /// Queues the recipient's notification unless they muted the thread or one for this thread went
    /// to them in the last 5 minutes (the dedupe key's prefix names the thread and recipient).
    /// </summary>
    private async Task NotifyAsync(Conversation c, bool senderIsTrainer, ulong me, string preview, DateTime now)
    {
        var recipient = senderIsTrainer ? c.MemberUserId : c.TrainerUserId;
        if (senderIsTrainer ? c.MemberMuted : c.TrainerMuted) return;
        var prefix = MessagingRules.PushKeyPrefix(c.Id, recipient);
        var since = now - MessagingRules.PushCollapseWindow;
        var recent = await db.CommunicationLogs.AnyAsync(l => l.UserId == recipient && l.Channel == CommunicationChannel.Push
                                                             && l.ProviderRef != null && l.ProviderRef.StartsWith(prefix) && l.CreatedAt > since);
        if (recent) return;
        var name = (await PeopleAsync([me])).GetValueOrDefault(me)?.Name ?? (senderIsTrainer ? "Your coach" : "A member");
        notifier.Add(c.TenantId, recipient, $"New message from {name}", preview, MessagingRules.Kind, c.Id,
            urgent: false, category: NotificationCategories.Messages, dedupeKey: prefix + now.Ticks);
    }

    private async Task<string?> HoursNoticeAsync(MessagingSettings s, ulong tenantId, DateTime now)
    {
        if (s.OutsideHoursNotice is null) return null;
        var clock = await TenantClock.ForAsync(db, tenantId);
        var local = TimeOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(now, DateTimeKind.Utc), clock.Zone));
        return MessagingRules.InWorkingHours(local, MessagingRules.ParseTime(s.WorkingHoursStart, "start"), MessagingRules.ParseTime(s.WorkingHoursEnd, "end"))
            ? null : s.OutsideHoursNotice;
    }

    /// <summary>Names and photos; a trainer's profile display name / photo win over the account's.</summary>
    internal async Task<Dictionary<ulong, MessagePerson>> PeopleAsync(IEnumerable<ulong> ids) => await People(db, ids);

    internal static async Task<Dictionary<ulong, MessagePerson>> People(IAppDbContext db, IEnumerable<ulong> ids)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0) return [];
        var users = await db.Users.AsNoTracking().Where(u => list.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName, u.AvatarUrl }).ToListAsync();
        var trainers = await db.TrainerProfiles.AsNoTracking().Where(t => t.UserId != null && list.Contains(t.UserId.Value))
            .Select(t => new { UserId = t.UserId!.Value, t.DisplayName, t.ProfileImage }).ToListAsync();
        return users.ToDictionary(u => u.Id, u =>
        {
            var t = trainers.FirstOrDefault(x => x.UserId == u.Id);
            return new MessagePerson
            {
                UserId = u.Id,
                Name = !string.IsNullOrWhiteSpace(t?.DisplayName) ? t!.DisplayName!.Trim() : SupportCommon.Name(u.FirstName, u.LastName, "Someone"),
                AvatarUrl = t?.ProfileImage ?? u.AvatarUrl,
                Role = t is null ? MemberSide : TrainerSide,
            };
        });
    }

    private static MessagePerson Unknown(ulong id, bool trainer) =>
        new() { UserId = id, Name = trainer ? "Your coach" : "A member", Role = trainer ? TrainerSide : MemberSide };

    internal static DirectMessageDto Map(DirectMessage m, ulong me, bool review = false, string? senderName = null) => new()
    {
        Id = m.Id, ClientMessageId = m.ClientMessageId, SenderId = m.SenderId, SenderName = senderName, Mine = m.SenderId == me,
        Body = m.Body, PhotoUrl = m.PhotoUrl, CreatedAt = m.CreatedAt, Redacted = m.RedactedAt is not null,
        Reported = review ? m.ReportedAt is not null : m.ReportedById == me,
        Attachment = m.AttachmentType is null || m.AttachmentId is null ? null : new MessageAttachmentDto
        {
            Type = m.AttachmentType, Id = m.AttachmentId.Value, TargetId = m.AttachmentTargetId ?? 0, Title = m.AttachmentTitle ?? "",
        },
    };
}
