using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Safety;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Safety;

/// <summary>
/// Waivers, health screening, emergency contacts and consents for members (self-service) and
/// staff (member detail, waiver management). Who may see what:
/// <list type="bullet">
///   <item>status / signatures / emergency contact — the member, staff with the members module, the member's assigned trainers;</item>
///   <item>health answers — the member, the member's assigned trainers, and admin/staff granted the
///   <c>health-screening</c> API key (module <c>admin.members.health</c>, admin role by default). Nobody else.</item>
/// </list>
/// </summary>
public class SafetyService(IAppDbContext db, ICurrentUser currentUser, SafetyGate gate, Notifier notifier, IAccessService access)
{
    public const string HealthApiModule = "health-screening";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");

    // ── Member: status ──────────────────────────────────────────────────────

    public Task<SafetyComplianceResponse> GetMyStatusAsync() => gate.EvaluateAsync(Me);

    // ── Member: waivers ─────────────────────────────────────────────────────

    /// <summary>Latest versions of active waivers the member still has to (re-)sign.</summary>
    public async Task<List<WaiverToSignResponse>> GetPendingWaiversAsync()
    {
        var tenantId = await gate.TenantOfAsync(Me);
        var statuses = await gate.WaiverStatusesAsync(tenantId, Me);
        var pending = statuses.Where(s => !s.Ok).ToList();
        if (pending.Count == 0) return [];
        var ids = pending.Select(p => p.LatestVersionId).ToList();
        var versions = await db.WaiverVersions.AsNoTracking().Where(v => ids.Contains(v.Id)).ToListAsync();
        return pending.Select(p =>
        {
            var v = versions.First(x => x.Id == p.LatestVersionId);
            return new WaiverToSignResponse
            {
                WaiverId = v.WaiverId, VersionId = v.Id, Version = v.Version, Title = v.Title, Body = v.Body,
                RequiresResign = v.RequiresResign, PreviouslySignedVersion = p.SignedVersion, PublishedAt = v.PublishedAt,
            };
        }).ToList();
    }

    /// <summary>Signs the latest version of an active waiver. Signing the same version again returns the existing signature.</summary>
    public async Task<WaiverSignatureResponse> SignWaiverAsync(ulong versionId, SignWaiverRequest r, RequestMeta meta)
    {
        if (!r.Agreed) throw new ArgumentException("Please tick the box to confirm you have read and agree to the waiver.");
        var signedName = CollapseSpaces(r.SignedName);
        if (signedName.Length < 2) throw new ArgumentException("Signature: type your full name to sign.");
        if (signedName.Length > 200) throw new ArgumentException("Signature: the name is too long.");

        var me = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == Me) ?? throw new KeyNotFoundException("Account not found.");
        if (!NameMatches(signedName, me.FirstName, me.LastName))
            throw new ArgumentException($"Signature: type your full name as it appears on your account ({CollapseSpaces($"{me.FirstName} {me.LastName}")}).");

        var version = await db.WaiverVersions.Include(v => v.Waiver)
            .FirstOrDefaultAsync(v => v.Id == versionId && v.TenantId == me.TenantId)
            ?? throw new KeyNotFoundException("Waiver not found.");
        if (!version.Waiver.IsActive) throw RuleException.Unprocessable("This waiver is no longer in use.");
        var latest = await db.WaiverVersions.Where(v => v.WaiverId == version.WaiverId).MaxAsync(v => v.Version);
        if (version.Version != latest) throw RuleException.Conflict("A newer version of this waiver was published. Please reload and read the latest version.");

        var existing = await db.WaiverSignatures.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == me.Id && s.WaiverVersionId == version.Id);
        if (existing is not null) return MapSignature(existing, version, null);

        var signature = new WaiverSignature
        {
            TenantId = me.TenantId, UserId = me.Id, WaiverId = version.WaiverId, WaiverVersionId = version.Id,
            VersionNumber = version.Version, SignedName = signedName, SignedAt = DateTime.UtcNow,
            Ip = Truncate(meta.Ip, 64), UserAgent = Truncate(meta.UserAgent, 512), BodyHash = version.BodyHash,
        };
        db.WaiverSignatures.Add(signature);
        await MarkOnboardingStepAsync(me.Id, "agreement");
        await db.SaveChangesAsync();
        return MapSignature(signature, version, null);
    }

    public async Task<List<WaiverSignatureResponse>> GetMySignaturesAsync() => await SignaturesOfAsync(Me);

    // ── Member: health questionnaire ────────────────────────────────────────

    public async Task<HealthQuestionnaireResponse> GetQuestionnaireAsync()
    {
        var tenantId = await gate.TenantOfAsync(Me);
        var settings = await gate.LoadSettingsAsync(tenantId);
        return new HealthQuestionnaireResponse
        {
            FormVersion = HealthQuestionnaire.FormVersion, ValidDays = settings.HealthValidDays,
            Questions = [.. HealthQuestionnaire.Questions],
        };
    }

    public async Task<HealthScreeningResponse?> GetMyLatestHealthAsync()
    {
        var latest = await db.HealthScreenings.AsNoTracking().Where(h => h.UserId == Me)
            .OrderByDescending(h => h.SubmittedAt).FirstOrDefaultAsync();
        return latest is null ? null : MapScreening(latest);
    }

    public async Task<HealthScreeningResponse> SubmitHealthAsync(SubmitHealthRequest r, RequestMeta meta)
    {
        var questions = HealthQuestionnaire.Questions;
        if (r.Answers is null || r.Answers.Count != questions.Length)
            throw new ArgumentException($"Answers: answer all {questions.Length} questions.");

        var me = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == Me) ?? throw new KeyNotFoundException("Account not found.");
        var tenantId = me.TenantId;

        // Health data is special-category data: explicit consent comes first (it can be given in the same step).
        if (!await Consents.IsGrantedAsync(db, tenantId, me.Id, ConsentTypes.HealthData))
        {
            if (!r.GrantHealthDataConsent)
                throw new RuleException("Please agree to the gym storing your health information before submitting.", RuleException.UnprocessableStatus)
                { Code = "HEALTH_CONSENT_REQUIRED" };
            db.ConsentRecords.Add(new ConsentRecord
            {
                TenantId = tenantId, UserId = me.Id, Type = ConsentTypes.HealthData, Granted = true, Version = "1",
                At = DateTime.UtcNow, Source = "health_form", Ip = Truncate(meta.Ip, 64),
            });
        }

        var settings = await gate.LoadSettingsAsync(tenantId);
        var now = DateTime.UtcNow;
        var answers = questions.Select((q, i) => new HealthAnswerResponse { Key = q.Key, Question = q.Text, Answer = r.Answers[i] }).ToList();
        var yes = answers.Count(a => a.Answer);
        var screening = new HealthScreening
        {
            TenantId = tenantId, UserId = me.Id, FormVersion = HealthQuestionnaire.FormVersion,
            Answers = JsonSerializer.SerializeToDocument(answers, Json), YesCount = yes,
            Conditions = Clean(r.Conditions, 2000), Medications = Clean(r.Medications, 2000),
            Injuries = Clean(r.Injuries, 2000), Pregnancy = Clean(r.Pregnancy, 500),
            NeedsClearance = yes > 0, SubmittedAt = now, ExpiresAt = now.AddDays(settings.HealthValidDays),
        };
        db.HealthScreenings.Add(screening);
        await MarkOnboardingStepAsync(me.Id, "health");

        if (screening.NeedsClearance)
        {
            var name = CollapseSpaces($"{me.FirstName} {me.LastName}");
            foreach (var recipient in await ClearanceRecipientsAsync(tenantId, me.Id))
                notifier.Add(tenantId, recipient, "Health check needs clearance",
                    $"{name} answered yes to {yes} health question{(yes == 1 ? "" : "s")}. Ask for a doctor's clearance before training.",
                    "health", me.Id);
        }
        await db.SaveChangesAsync();
        return MapScreening(screening);
    }

    /// <summary>Gym admins plus the member's assigned trainers.</summary>
    private async Task<List<ulong>> ClearanceRecipientsAsync(ulong tenantId, ulong memberId)
    {
        var admins = await (from u in db.Users
                            join role in db.Roles.IgnoreQueryFilters() on u.RoleId equals role.Id
                            where u.TenantId == tenantId && u.DeletedAt == null && role.Slug == RoleNames.Admin
                            select u.Id).ToListAsync();
        var trainers = await (from a in db.TrainerClientAssignments
                              join t in db.TrainerProfiles on a.TrainerId equals t.Id
                              where a.ClientId == memberId && a.Status == Domain.Enums.TrainerAssignmentStatus.Active && t.UserId != null
                              select t.UserId!.Value).ToListAsync();
        return admins.Concat(trainers).Distinct().ToList();
    }

    // ── Member: emergency contact ───────────────────────────────────────────

    public async Task<EmergencyContactResponse?> GetMyEmergencyContactAsync() =>
        await EmergencyContacts.GetAsync(db, await gate.TenantOfAsync(Me), Me);

    public async Task<EmergencyContactResponse> SetMyEmergencyContactAsync(EmergencyContactRequest r)
    {
        var name = CollapseSpaces(r.Name);
        if (name.Length < 2) throw new ArgumentException("Name: enter your emergency contact's name.");
        if (name.Length > 150) throw new ArgumentException("Name: keep it under 150 characters.");
        var phone = EmergencyContacts.NormalizePhone(r.Phone ?? "");
        var relationship = Clean(r.Relationship, 60);

        var tenantId = await gate.TenantOfAsync(Me);
        var row = await db.MemberEmergencyContacts.FirstOrDefaultAsync(c => c.TenantId == tenantId && c.UserId == Me);
        if (row is null)
        {
            row = new MemberEmergencyContact { TenantId = tenantId, UserId = Me, Name = name, Phone = phone };
            db.MemberEmergencyContacts.Add(row);
        }
        row.Name = name; row.Phone = phone; row.Relationship = relationship; row.UpdatedByUserId = Me;
        await db.SaveChangesAsync();
        return new EmergencyContactResponse { Name = row.Name, Relationship = row.Relationship, Phone = row.Phone, Source = "profile", UpdatedAt = row.UpdatedAt };
    }

    // ── Staff: member detail ────────────────────────────────────────────────

    public async Task<MemberSafetyResponse> GetMemberSafetyAsync(ulong memberId)
    {
        await EnsureCanSeeMemberAsync(memberId);
        var compliance = await gate.EvaluateAsync(memberId);
        var overrides = await (from o in db.SafetyGateOverrides.AsNoTracking()
                               where o.UserId == memberId
                               orderby o.At descending
                               select o).Take(10).ToListAsync();
        var staffIds = overrides.Select(o => o.OverriddenByUserId).Distinct().ToList();
        var staffNames = await db.Users.IgnoreQueryFilters().Where(u => staffIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName }).ToDictionaryAsync(u => u.Id, u => CollapseSpaces($"{u.FirstName} {u.LastName}"));
        var consents = await new ConsentService(db, currentUser).GetForAsync(memberId);
        return new MemberSafetyResponse
        {
            Compliance = compliance,
            Signatures = await SignaturesOfAsync(memberId),
            CanViewHealthAnswers = await CanViewHealthAsync(memberId),
            RecentOverrides = overrides.Select(o => new SafetyOverrideResponse
            {
                Id = o.Id, Context = o.Context, Missing = [.. o.Missing.Split(',', StringSplitOptions.RemoveEmptyEntries)],
                Reason = o.Reason, OverriddenByUserId = o.OverriddenByUserId,
                OverriddenByName = staffNames.GetValueOrDefault(o.OverriddenByUserId), At = o.At,
            }).ToList(),
            Consents = consents.Current,
        };
    }

    /// <summary>The signed copy (waiver text exactly as signed + signature details), for viewing / printing.</summary>
    public async Task<WaiverSignatureResponse> GetSignedCopyAsync(ulong signatureId)
    {
        var s = await db.WaiverSignatures.AsNoTracking().Include(x => x.WaiverVersion)
            .FirstOrDefaultAsync(x => x.Id == signatureId) ?? throw new KeyNotFoundException("Signature not found.");
        if (s.UserId != currentUser.UserId) await EnsureCanSeeMemberAsync(s.UserId);
        var name = await db.Users.Where(u => u.Id == s.UserId).Select(u => u.FirstName + " " + u.LastName).FirstOrDefaultAsync();
        var r = MapSignature(s, s.WaiverVersion, name);
        r.Body = s.WaiverVersion.Body;
        return r;
    }

    /// <summary>Health answers: the latest submission plus earlier ones (newest first). 403 unless <see cref="CanViewHealthAsync"/>.</summary>
    public async Task<List<HealthScreeningResponse>> GetMemberHealthAsync(ulong memberId)
    {
        if (!await db.Users.AnyAsync(u => u.Id == memberId && u.DeletedAt == null)) throw new KeyNotFoundException("Member not found.");
        if (!await CanViewHealthAsync(memberId))
            throw new UnauthorizedAccessException("Health answers are only visible to gym admins with health access and the member's own trainers.");
        var rows = await db.HealthScreenings.AsNoTracking().Where(h => h.UserId == memberId)
            .OrderByDescending(h => h.SubmittedAt).Take(10).ToListAsync();
        return rows.Select(MapScreening).ToList();
    }

    /// <summary>Staff record that a medical clearance was received for a "yes" answer.</summary>
    public async Task<HealthScreeningResponse> ClearHealthAsync(ulong memberId, ulong screeningId, ClearHealthRequest r)
    {
        if (currentUser.IsClient() || currentUser.IsTrainer() ||
            !await access.CanAsync(Me, currentUser.Role, HealthApiModule, "edit", [ModuleCatalog.AdminApp]))
            throw new UnauthorizedAccessException("Only gym staff with health access can record a medical clearance.");
        var row = await db.HealthScreenings.FirstOrDefaultAsync(h => h.Id == screeningId && h.UserId == memberId)
                  ?? throw new KeyNotFoundException("Health check not found.");
        if (!row.NeedsClearance) throw RuleException.Unprocessable("This health check doesn't need clearance.");
        if (row.ClearedAt is not null) return MapScreening(row);
        row.ClearedAt = DateTime.UtcNow;
        row.ClearedByUserId = Me;
        row.ClearanceNote = Clean(r.Note, 1000);
        await db.SaveChangesAsync();
        return MapScreening(row);
    }

    /// <summary>
    /// The health visibility rule: the member themself; a trainer only for members actively
    /// assigned to them; admin / staff / custom roles only with the health-screening grant.
    /// </summary>
    public async Task<bool> CanViewHealthAsync(ulong memberId)
    {
        if (currentUser.UserId is not { } me) return false;
        if (me == memberId) return true;
        if (currentUser.IsClient()) return false;
        if (currentUser.IsTrainer()) return await db.AssignedClientIds(me).AnyAsync(id => id == memberId);
        return await access.CanAsync(me, currentUser.Role, HealthApiModule, "view", [ModuleCatalog.AdminApp]);
    }

    private async Task EnsureCanSeeMemberAsync(ulong memberId)
    {
        if (await db.GetActionableUserAsync(currentUser, memberId) is null) throw new KeyNotFoundException("Member not found.");
    }

    // ── Admin: waiver documents ─────────────────────────────────────────────

    public async Task<List<AdminWaiverResponse>> GetWaiversAsync()
    {
        var tenantId = currentUser.ResolveTenantId();
        var docs = await db.WaiverDocuments.AsNoTracking().Include(d => d.Versions)
            .Where(d => d.TenantId == tenantId).OrderByDescending(d => d.IsActive).ThenBy(d => d.Title).ToListAsync();
        var versionIds = docs.SelectMany(d => d.Versions).Select(v => v.Id).ToList();
        var counts = await db.WaiverSignatures.Where(s => versionIds.Contains(s.WaiverVersionId))
            .GroupBy(s => s.WaiverVersionId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);
        return docs.Select(d =>
        {
            var latest = d.Versions.MaxBy(v => v.Version);
            return new AdminWaiverResponse
            {
                Id = d.Id, Title = d.Title, IsActive = d.IsActive, CreatedAt = d.CreatedAt,
                LatestVersion = latest?.Version ?? 0, LatestVersionId = latest?.Id, LatestBody = latest?.Body ?? "",
                Versions = d.Versions.OrderByDescending(v => v.Version).Select(v => new AdminWaiverVersionResponse
                {
                    Id = v.Id, Version = v.Version, Title = v.Title, RequiresResign = v.RequiresResign,
                    PublishedAt = v.PublishedAt, SignatureCount = counts.GetValueOrDefault(v.Id),
                }).ToList(),
            };
        }).ToList();
    }

    public async Task<AdminWaiverResponse> CreateWaiverAsync(CreateWaiverRequest r)
    {
        var tenantId = currentUser.ResolveTenantId();
        var (title, body) = ValidateText(r.Title, r.Body);
        var doc = new WaiverDocument { TenantId = tenantId, Title = title, IsActive = true, CreatedByUserId = currentUser.UserId };
        db.WaiverDocuments.Add(doc);
        doc.Versions.Add(NewVersion(doc, 1, title, body, requiresResign: true));
        await db.SaveChangesAsync();
        return (await GetWaiversAsync()).First(w => w.Id == doc.Id);
    }

    /// <summary>Publishes a new version (versions are never edited in place: signatures point at them).</summary>
    public async Task<AdminWaiverResponse> PublishVersionAsync(ulong waiverId, PublishWaiverVersionRequest r)
    {
        var tenantId = currentUser.ResolveTenantId();
        var doc = await db.WaiverDocuments.FirstOrDefaultAsync(d => d.Id == waiverId && d.TenantId == tenantId)
                  ?? throw new KeyNotFoundException("Waiver not found.");
        var (title, body) = ValidateText(string.IsNullOrWhiteSpace(r.Title) ? doc.Title : r.Title, r.Body);
        var latest = await db.WaiverVersions.Where(v => v.WaiverId == doc.Id)
            .OrderByDescending(v => v.Version).FirstOrDefaultAsync();
        if (latest is not null && latest.Title == title && latest.Body == body)
            throw RuleException.Unprocessable("Nothing changed: the text is the same as the current version.");
        db.WaiverVersions.Add(NewVersion(doc, (latest?.Version ?? 0) + 1, title, body, r.RequiresResign));
        if (doc.Title != title) doc.Title = title;
        await db.SaveChangesAsync();
        return (await GetWaiversAsync()).First(w => w.Id == doc.Id);
    }

    public async Task<AdminWaiverResponse> UpdateWaiverAsync(ulong waiverId, UpdateWaiverRequest r)
    {
        var tenantId = currentUser.ResolveTenantId();
        var doc = await db.WaiverDocuments.FirstOrDefaultAsync(d => d.Id == waiverId && d.TenantId == tenantId)
                  ?? throw new KeyNotFoundException("Waiver not found.");
        if (r.IsActive is { } active) doc.IsActive = active;
        if (!string.IsNullOrWhiteSpace(r.Title))
        {
            var t = CollapseSpaces(r.Title);
            if (t.Length > 200) throw new ArgumentException("Title: keep it under 200 characters.");
            doc.Title = t;
        }
        await db.SaveChangesAsync();
        return (await GetWaiversAsync()).First(w => w.Id == doc.Id);
    }

    public static WaiverTemplateResponse GetTemplate() => new() { Title = WaiverTemplate.Title, Body = WaiverTemplate.Body, IsPlaceholder = true };

    public Task<SafetySettings> GetSettingsAsync() => gate.LoadSettingsAsync(currentUser.ResolveTenantId());

    public Task<SafetySettings> UpdateSettingsAsync(SafetySettings s) => gate.SaveSettingsAsync(currentUser.ResolveTenantId(), s);

    // ── Helpers ─────────────────────────────────────────────────────────────

    private WaiverVersion NewVersion(WaiverDocument doc, int number, string title, string body, bool requiresResign) => new()
    {
        TenantId = doc.TenantId, Waiver = doc, WaiverId = doc.Id, Version = number, Title = title, Body = body,
        BodyHash = Hash(title, body), RequiresResign = requiresResign, PublishedAt = DateTime.UtcNow, PublishedByUserId = currentUser.UserId,
    };

    public static string Hash(string title, string body) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(title + "\n\n" + body))).ToLowerInvariant();

    private static (string Title, string Body) ValidateText(string? title, string? body)
    {
        var t = CollapseSpaces(title ?? "");
        var b = (body ?? "").Replace("\r\n", "\n").Trim();
        if (t.Length < 3) throw new ArgumentException("Title: enter a title.");
        if (t.Length > 200) throw new ArgumentException("Title: keep it under 200 characters.");
        if (b.Length < 20) throw new ArgumentException("Body: the waiver text is too short.");
        if (b.Length > 50_000) throw new ArgumentException("Body: the waiver text is too long (50,000 characters max).");
        return (t, b);
    }

    private async Task<List<WaiverSignatureResponse>> SignaturesOfAsync(ulong userId)
    {
        var rows = await db.WaiverSignatures.AsNoTracking().Include(s => s.WaiverVersion)
            .Where(s => s.UserId == userId).OrderByDescending(s => s.SignedAt).ToListAsync();
        return rows.Select(s => MapSignature(s, s.WaiverVersion, null)).ToList();
    }

    private static WaiverSignatureResponse MapSignature(WaiverSignature s, WaiverVersion v, string? memberName) => new()
    {
        Id = s.Id, UserId = s.UserId, MemberName = memberName is null ? null : CollapseSpaces(memberName),
        WaiverId = s.WaiverId, WaiverVersionId = s.WaiverVersionId, Version = s.VersionNumber, Title = v.Title,
        SignedName = s.SignedName, SignedAt = s.SignedAt, Ip = s.Ip, UserAgent = s.UserAgent, BodyHash = s.BodyHash,
    };

    private static HealthScreeningResponse MapScreening(HealthScreening h) => new()
    {
        Id = h.Id, UserId = h.UserId, FormVersion = h.FormVersion,
        Answers = h.Answers.Deserialize<List<HealthAnswerResponse>>(Json) ?? [],
        YesCount = h.YesCount, Conditions = h.Conditions, Medications = h.Medications, Injuries = h.Injuries,
        Pregnancy = h.Pregnancy, NeedsClearance = h.NeedsClearance, SubmittedAt = h.SubmittedAt, ExpiresAt = h.ExpiresAt,
        Expired = h.ExpiresAt <= DateTime.UtcNow, ClearedAt = h.ClearedAt, ClearanceNote = h.ClearanceNote,
    };

    /// <summary>Ticks the member's matching onboarding step (OnboardingController's checklist) if one was started.</summary>
    private async Task MarkOnboardingStepAsync(ulong userId, string stepKey)
    {
        var step = await db.OnboardingSteps.FirstOrDefaultAsync(s => s.UserId == userId && s.StepKey == stepKey && !s.IsDone);
        if (step is null) return;
        step.IsDone = true;
        step.DoneAt = DateTime.UtcNow;
    }

    internal static bool NameMatches(string signed, string? first, string? last)
    {
        static string[] Tokens(string? s) => CollapseSpaces(s ?? "").ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var typed = Tokens(signed);
        var expected = Tokens(first).Concat(Tokens(last)).ToArray();
        if (expected.Length == 0) return typed.Length > 0; // no name on file: any non-empty name
        // Every word of the account name must be typed (middle names may be added).
        return expected.All(typed.Contains);
    }

    private static string CollapseSpaces(string s) => string.Join(' ', s.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    private static string? Clean(string? s, int max)
    {
        var t = s?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        return t.Length > max ? t[..max] : t;
    }

    private static string? Truncate(string? s, int max) => s is null ? null : s.Length > max ? s[..max] : s;
}

/// <summary>Consent records: append-only grants and withdrawals.</summary>
public class ConsentService(IAppDbContext db, ICurrentUser currentUser)
{
    public async Task<ConsentsResponse> GetMineAsync() => await GetForAsync(currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again."));

    public async Task<ConsentsResponse> GetForAsync(ulong userId)
    {
        var rows = await db.ConsentRecords.AsNoTracking().Where(c => c.UserId == userId)
            .OrderByDescending(c => c.At).Take(200).ToListAsync();
        return new ConsentsResponse
        {
            Current = ConsentTypes.All.Select(type =>
            {
                var latest = rows.FirstOrDefault(r => r.Type == type);
                return new ConsentStateResponse { Type = type, Granted = latest?.Granted ?? false, Version = latest?.Version, At = latest?.At, Source = latest?.Source };
            }).ToList(),
            History = rows.Select(r => new ConsentHistoryResponse { Id = r.Id, Type = r.Type, Granted = r.Granted, Version = r.Version, At = r.At, Source = r.Source }).ToList(),
        };
    }

    /// <summary>Appends a grant / withdrawal for the caller. Re-sending the current state is a no-op.</summary>
    public async Task<ConsentsResponse> RecordMineAsync(RecordConsentRequest r, string? ip)
    {
        var me = currentUser.UserId ?? throw new UnauthorizedAccessException("Sign in again.");
        var type = (r.Type ?? "").Trim().ToLowerInvariant();
        if (!ConsentTypes.All.Contains(type))
            throw new ArgumentException($"Type: must be one of {string.Join(", ", ConsentTypes.All)}.");
        var source = string.IsNullOrWhiteSpace(r.Source) ? "app" : r.Source.Trim().ToLowerInvariant();
        if (!Consents.Sources.Contains(source)) throw new ArgumentException($"Source: must be one of {string.Join(", ", Consents.Sources)}.");
        var version = string.IsNullOrWhiteSpace(r.Version) ? "1" : r.Version.Trim();
        if (version.Length > 40) throw new ArgumentException("Version: keep it under 40 characters.");

        var tenantId = await db.Users.Where(u => u.Id == me).Select(u => (ulong?)u.TenantId).FirstOrDefaultAsync()
                       ?? throw new KeyNotFoundException("Account not found.");
        var latest = await db.ConsentRecords.AsNoTracking()
            .Where(c => c.UserId == me && c.Type == type)
            .OrderByDescending(c => c.At).FirstOrDefaultAsync();
        if (latest is null || latest.Granted != r.Granted || latest.Version != version)
        {
            db.ConsentRecords.Add(new ConsentRecord
            {
                TenantId = tenantId, UserId = me, Type = type, Granted = r.Granted, Version = version,
                At = DateTime.UtcNow, Source = source, Ip = ip is { Length: > 64 } ? ip[..64] : ip,
            });
            await db.SaveChangesAsync();
        }
        return await GetForAsync(me);
    }
}
