using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Facilities;
using GymManagmentApplication.Domain.Entities.Platform;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Facilities;

/// <summary>
/// The staff incident log (module <c>admin.incidents</c>, API key <c>incidents</c>). Only staff
/// with that module reach it (controller gates); members never see incidents.
/// <list type="bullet">
/// <item>Editable while Open. Closing seals it: no field changes (service check + ClosedIncidentGuard
/// on SaveChanges); later facts go in append-only addenda.</item>
/// <item>Every list, view, create, edit, close and addendum writes an AuditLog row (EntityType
/// "Incident"). Edits record the names of the fields changed, never their values, so the audit
/// log holds no copy of the sensitive text.</item>
/// </list>
/// </summary>
public class IncidentService(IAppDbContext db, ICurrentUser currentUser)
{
    public const string AuditEntity = "Incident";

    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    private ulong TenantId => currentUser.ResolveTenantId();

    public static string Reference(ulong id) => $"INC-{id:D6}";

    public async Task<IncidentPage> ListAsync(IncidentQuery q, RequestMeta meta)
    {
        var query = db.Incidents.AsNoTracking().Include(i => i.People).AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Status))
            query = Enum.TryParse<IncidentStatus>(q.Status, true, out var st) ? query.Where(i => i.Status == st) : throw new ArgumentException("Status must be open or closed.");
        if (q.BranchId is { } b) query = query.Where(i => i.BranchId == b);
        if (!string.IsNullOrWhiteSpace(q.Type)) query = query.Where(i => i.Type == q.Type.Trim().ToLower());
        if (!string.IsNullOrWhiteSpace(q.Severity) && Enum.TryParse<IncidentSeverity>(q.Severity, true, out var sev)) query = query.Where(i => i.Severity == sev);
        if (q.From is { } from) query = query.Where(i => i.OccurredAt >= DateTime.SpecifyKind(from, DateTimeKind.Utc));
        if (q.To is { } to) query = query.Where(i => i.OccurredAt <= DateTime.SpecifyKind(to, DateTimeKind.Utc));
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().ToLower();
            query = query.Where(i => i.Location.ToLower().Contains(term) || i.Description.ToLower().Contains(term)
                                     || i.People.Any(p => p.Name.ToLower().Contains(term)));
        }
        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(i => i.OccurredAt).Page(q.Page, q.Size).ToListAsync();
        var branches = await FacilitiesCommon.BranchNamesAsync(db, rows.Select(r => r.BranchId));
        Audit("list", null, meta, new { count = rows.Count, q.Status, q.BranchId, q.Type, search = !string.IsNullOrWhiteSpace(q.Q) });
        await db.SaveChangesAsync();
        return new IncidentPage
        {
            Items = rows.Select(r => { var d = new IncidentListItem(); FillItem(d, r, branches); return d; }).ToList(),
            Total = total,
            OpenCount = await db.Incidents.CountAsync(i => i.Status == IncidentStatus.Open),
        };
    }

    public async Task<IncidentDetail> GetAsync(ulong id, RequestMeta meta)
    {
        var row = await LoadAsync(id, track: false);
        Audit("view", id, meta);
        await db.SaveChangesAsync();
        return await DetailAsync(row);
    }

    public async Task<IncidentDetail> CreateAsync(IncidentRequest r, RequestMeta meta)
    {
        var row = new Incident { TenantId = TenantId, ReportedByUserId = Me };
        await ApplyAsync(row, r);
        db.Incidents.Add(row);
        await db.SaveChangesAsync();
        Audit("create", row.Id, meta);
        await db.SaveChangesAsync();
        return await DetailAsync(row);
    }

    public async Task<IncidentDetail> UpdateAsync(ulong id, IncidentRequest r, RequestMeta meta)
    {
        var row = await LoadAsync(id, track: true);
        EnsureOpen(row);
        var before = Snapshot(row);
        await ApplyAsync(row, r);
        var after = Snapshot(row);
        var changed = before.Where(kv => after.GetValueOrDefault(kv.Key) != kv.Value).Select(kv => kv.Key).ToList();
        await db.SaveChangesAsync();
        Audit("update", id, meta, new { fields = changed });
        await db.SaveChangesAsync();
        return await DetailAsync(row);
    }

    public async Task<IncidentDetail> CloseAsync(ulong id, CloseIncidentRequest r, RequestMeta meta)
    {
        var row = await LoadAsync(id, track: true);
        EnsureOpen(row);
        row.ClosureNote = FacilitiesCommon.Clean(r.ClosureNote, 2000, "The closing note");
        row.Status = IncidentStatus.Closed;
        row.ClosedAt = DateTime.UtcNow;
        row.ClosedByUserId = Me;
        Audit("close", id, meta);
        await db.SaveChangesAsync();
        return await DetailAsync(row);
    }

    /// <summary>Append-only: adds information to an open or closed incident.</summary>
    public async Task<IncidentDetail> AddAddendumAsync(ulong id, AddendumRequest r, RequestMeta meta)
    {
        var row = await LoadAsync(id, track: false);
        var body = FacilitiesCommon.Clean(r.Body, 5000, "The addendum") ?? throw new ArgumentException("Write the addendum.");
        db.IncidentAddenda.Add(new IncidentAddendum { TenantId = row.TenantId, IncidentId = id, Body = body, AuthorUserId = Me });
        Audit("addendum", id, meta);
        await db.SaveChangesAsync();
        return await DetailAsync(row);
    }

    /// <summary>Who looked at / changed this incident, newest first (itself audited).</summary>
    public async Task<List<IncidentAuditEntry>> AuditTrailAsync(ulong id, RequestMeta meta)
    {
        await LoadAsync(id, track: false);
        var rows = await db.AuditLogs.AsNoTracking().Where(a => a.EntityType == AuditEntity && a.EntityId == id)
            .OrderByDescending(a => a.CreatedAt).Take(500).ToListAsync();
        var names = await FacilitiesCommon.NamesAsync(db, rows.Select(r => r.UserId));
        Audit("view_audit", id, meta);
        await db.SaveChangesAsync();
        return rows.Select(a => new IncidentAuditEntry
        {
            At = a.CreatedAt, Action = a.Action.Replace("incident.", ""), UserName = a.UserId is { } u ? names.GetValueOrDefault(u) : null,
            Fields = a.NewValues?.RootElement is { ValueKind: JsonValueKind.Object } o && o.TryGetProperty("fields", out var f) && f.ValueKind == JsonValueKind.Array
                ? f.EnumerateArray().Select(x => x.GetString() ?? "").ToList() : [],
        }).ToList();
    }

    /// <summary>Members and staff to link as people involved (name / email / phone search).</summary>
    public async Task<List<PersonSearchItem>> SearchPeopleAsync(string? q)
    {
        var term = (q ?? "").Trim().ToLower();
        if (term.Length < 2) return [];
        return await (from u in db.Users.AsNoTracking()
                      join role in db.Roles on u.RoleId equals role.Id
                      where u.DeletedAt == null && role.Slug != RoleNames.SuperAdmin
                            && ((u.FirstName + " " + u.LastName).ToLower().Contains(term) || u.Email.ToLower().Contains(term)
                                || (u.Phone != null && u.Phone.Contains(term)))
                      orderby u.FirstName, u.LastName
                      select new PersonSearchItem
                      {
                          Id = u.Id, Name = (u.FirstName + " " + u.LastName).Trim(),
                          Kind = role.Slug == RoleNames.Client ? IncidentPersonKinds.Member : IncidentPersonKinds.Staff,
                          Email = u.Email, Phone = u.Phone,
                      }).Take(20).ToListAsync();
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static void EnsureOpen(Incident row)
    {
        if (row.Status == IncidentStatus.Closed)
            throw new RuleException("This incident is closed and can't be changed. Add an addendum instead.", RuleException.ConflictStatus) { Code = "INCIDENT_CLOSED" };
    }

    private async Task<Incident> LoadAsync(ulong id, bool track)
    {
        var q = db.Incidents.Include(i => i.People).AsQueryable();
        if (!track) q = q.AsNoTracking();
        return await q.FirstOrDefaultAsync(i => i.Id == id) ?? throw new KeyNotFoundException("Incident not found.");
    }

    private void Audit(string action, ulong? id, RequestMeta meta, object? values = null) =>
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = TenantId, UserId = currentUser.UserId, Action = $"incident.{action}", EntityType = AuditEntity, EntityId = id,
            NewValues = values is null ? null : JsonSerializer.SerializeToDocument(values),
            IpAddress = meta.Ip is { Length: > 45 } ip ? ip[..45] : meta.Ip,
            UserAgent = meta.UserAgent is { Length: > 500 } ua ? ua[..500] : meta.UserAgent,
            CreatedAt = DateTime.UtcNow,
        });

    private async Task ApplyAsync(Incident row, IncidentRequest r)
    {
        if (r.OccurredAt == default) throw new ArgumentException("When did it happen?");
        var occurred = DateTime.SpecifyKind(r.OccurredAt, r.OccurredAt.Kind == DateTimeKind.Local ? DateTimeKind.Local : DateTimeKind.Utc).ToUniversalTime();
        if (occurred > DateTime.UtcNow.AddMinutes(10)) throw new ArgumentException("The time can't be in the future.");
        if (!await db.Branches.AnyAsync(b => b.Id == r.BranchId)) throw new ArgumentException("Branch not found.");
        var type = (r.Type ?? "").Trim().ToLowerInvariant();
        if (!IncidentTypes.All.Contains(type)) throw new ArgumentException("Pick the type of incident.");
        if (!Enum.TryParse<IncidentSeverity>(r.Severity, true, out var severity)) throw new ArgumentException("Severity must be Low, Medium, High or Critical.");
        if (r.AssetId is { } a && !await db.FacilityAssets.AnyAsync(x => x.Id == a)) throw new ArgumentException("Asset not found.");
        if (r.People.Count > 20) throw new ArgumentException("Add at most 20 people.");

        row.OccurredAt = occurred;
        row.BranchId = r.BranchId;
        row.Location = FacilitiesCommon.Clean(r.Location, 200, "The location") ?? throw new ArgumentException("Where did it happen?");
        row.Type = type;
        row.Severity = severity;
        row.Description = FacilitiesCommon.Clean(r.Description, 10_000, "The description") ?? throw new ArgumentException("Describe what happened.");
        row.FirstAidGiven = r.FirstAidGiven;
        row.FirstAidBy = r.FirstAidGiven ? FacilitiesCommon.Clean(r.FirstAidBy, 150, "First aid by") : null;
        row.AmbulanceCalled = r.AmbulanceCalled;
        row.Witnesses = FacilitiesCommon.Clean(r.Witnesses, 2000, "Witnesses");
        row.FollowUpActions = FacilitiesCommon.Clean(r.FollowUpActions, 4000, "Follow-up actions");
        row.AttachmentUrls = FacilitiesCommon.JoinUrls(r.AttachmentUrls, FacilitiesCommon.MaxAttachments, "attachments");
        row.AssetId = r.AssetId;

        // People: replaced as a set while the incident is open.
        var userIds = r.People.Where(p => p.UserId is > 0).Select(p => p.UserId!.Value).Distinct().ToList();
        var users = userIds.Count == 0 ? [] : await db.Users.Where(u => userIds.Contains(u.Id) && u.DeletedAt == null)
            .ToDictionaryAsync(u => u.Id, u => (u.FirstName + " " + u.LastName).Trim());
        var people = new List<IncidentPerson>();
        foreach (var p in r.People)
        {
            var kind = (p.Kind ?? "").Trim().ToLowerInvariant();
            if (!IncidentPersonKinds.All.Contains(kind)) throw new ArgumentException("Each person is a member, staff or visitor.");
            ulong? userId = kind == IncidentPersonKinds.Visitor ? null : p.UserId;
            if (userId is { } uid && !users.ContainsKey(uid)) throw new ArgumentException("A linked person wasn't found in this gym.");
            var name = FacilitiesCommon.Clean(p.Name, 150, "The name") ?? (userId is { } x ? users[x] : null)
                       ?? throw new ArgumentException("Give each visitor's name.");
            people.Add(new IncidentPerson
            {
                TenantId = row.TenantId, Kind = kind, UserId = userId, Name = name, Contact = FacilitiesCommon.Clean(p.Contact, 200, "The contact"),
                IsInjuredParty = p.IsInjuredParty, Notes = FacilitiesCommon.Clean(p.Notes, 1000, "Notes"),
            });
        }
        var sameAsBefore = row.People.Count == people.Count && row.People.Zip(people).All(z =>
            z.First.Kind == z.Second.Kind && z.First.UserId == z.Second.UserId && z.First.Name == z.Second.Name &&
            z.First.Contact == z.Second.Contact && z.First.IsInjuredParty == z.Second.IsInjuredParty && z.First.Notes == z.Second.Notes);
        if (!sameAsBefore)
        {
            foreach (var old in row.People) db.IncidentPeople.Remove(old);
            row.People.Clear();
            row.People.AddRange(people);
        }
    }

    private static Dictionary<string, string?> Snapshot(Incident i) => new()
    {
        ["occurredAt"] = i.OccurredAt.ToString("O"), ["branch"] = i.BranchId.ToString(), ["location"] = i.Location, ["type"] = i.Type,
        ["severity"] = i.Severity.ToString(), ["description"] = i.Description, ["firstAid"] = $"{i.FirstAidGiven}|{i.FirstAidBy}",
        ["ambulance"] = i.AmbulanceCalled.ToString(), ["witnesses"] = i.Witnesses, ["followUp"] = i.FollowUpActions,
        ["attachments"] = i.AttachmentUrls, ["asset"] = i.AssetId?.ToString(),
        ["people"] = string.Join(";", i.People.Select(p => $"{p.Kind}|{p.UserId}|{p.Name}|{p.Contact}|{p.IsInjuredParty}|{p.Notes}")),
    };

    private static void FillItem(IncidentListItem d, Incident r, Dictionary<ulong, string> branches)
    {
        d.Id = r.Id; d.Reference = Reference(r.Id); d.OccurredAt = r.OccurredAt; d.BranchId = r.BranchId;
        d.BranchName = branches.GetValueOrDefault(r.BranchId); d.Location = r.Location; d.Type = r.Type; d.TypeLabel = IncidentTypes.Label(r.Type);
        d.Severity = r.Severity.ToString(); d.Status = r.Status.ToString(); d.AmbulanceCalled = r.AmbulanceCalled; d.CreatedAt = r.CreatedAt;
        var first = r.People.OrderByDescending(p => p.IsInjuredParty).FirstOrDefault();
        d.PeopleSummary = first is null ? null : r.People.Count > 1 ? $"{first.Name} +{r.People.Count - 1}" : first.Name;
    }

    private async Task<IncidentDetail> DetailAsync(Incident r)
    {
        var branches = await FacilitiesCommon.BranchNamesAsync(db, [r.BranchId]);
        var addenda = await db.IncidentAddenda.AsNoTracking().Where(a => a.IncidentId == r.Id).OrderBy(a => a.CreatedAt).ToListAsync();
        var names = await FacilitiesCommon.NamesAsync(db, addenda.Select(a => (ulong?)a.AuthorUserId).Append(r.ReportedByUserId).Append(r.ClosedByUserId));
        var d = new IncidentDetail();
        FillItem(d, r, branches);
        d.Description = r.Description; d.FirstAidGiven = r.FirstAidGiven; d.FirstAidBy = r.FirstAidBy; d.Witnesses = r.Witnesses;
        d.FollowUpActions = r.FollowUpActions; d.AttachmentUrls = FacilitiesCommon.SplitUrls(r.AttachmentUrls); d.AssetId = r.AssetId;
        d.AssetName = r.AssetId is { } a ? await db.FacilityAssets.Where(x => x.Id == a).Select(x => x.Name).FirstOrDefaultAsync() : null;
        d.People = r.People.Select(p => new IncidentPersonDto
        {
            Id = p.Id, Kind = p.Kind, UserId = p.UserId, Name = p.Name, Contact = p.Contact, IsInjuredParty = p.IsInjuredParty, Notes = p.Notes,
        }).ToList();
        d.Addenda = addenda.Select(a => new IncidentAddendumDto
        {
            Id = a.Id, Body = a.Body, AuthorName = names.GetValueOrDefault(a.AuthorUserId) ?? "Staff", CreatedAt = a.CreatedAt,
        }).ToList();
        d.ReportedByName = names.GetValueOrDefault(r.ReportedByUserId) ?? "Staff";
        d.ClosedAt = r.ClosedAt;
        d.ClosedByName = r.ClosedByUserId is { } c ? names.GetValueOrDefault(c) : null;
        d.ClosureNote = r.ClosureNote;
        d.CanEdit = r.Status == IncidentStatus.Open;
        return d;
    }
}
