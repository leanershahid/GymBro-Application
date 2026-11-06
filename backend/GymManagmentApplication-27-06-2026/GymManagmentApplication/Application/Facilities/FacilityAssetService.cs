using System.Security.Cryptography;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Operations;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Facilities;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Facilities;

/// <summary>
/// The gym-floor equipment register: assets per branch and zone, their service status
/// (In service / Limited / Out of service, with reason, since and expected back date) and their
/// maintenance history. A key facility (pool, sauna) going out of service can also post a
/// service-status notice — only when the caller asks for it (<see cref="SetAssetStatusRequest.PostServiceNotice"/>);
/// that notice is ended automatically when the asset is back in service.
/// </summary>
public class FacilityAssetService(IAppDbContext db, ICurrentUser currentUser, ServiceStatusService serviceStatus, Notifier notifier)
{
    private ulong TenantId => currentUser.ResolveTenantId();
    private const int MaxBulk = 100;

    // ═════════════════════════════ Staff: register ═════════════════════════════

    public async Task<List<AssetDto>> ListAsync(AssetQuery q)
    {
        var query = db.FacilityAssets.AsNoTracking().AsQueryable();
        if (!q.IncludeArchived) query = query.Where(a => a.ArchivedAt == null);
        if (q.BranchId is { } b) query = query.Where(a => a.BranchId == b);
        if (!string.IsNullOrWhiteSpace(q.Zone)) query = query.Where(a => a.Zone == q.Zone.Trim());
        if (!string.IsNullOrWhiteSpace(q.Status))
        {
            if (q.Status.Equals("down", StringComparison.OrdinalIgnoreCase))
                query = query.Where(a => a.Status != AssetStatus.InService);
            else if (Enum.TryParse<AssetStatus>(q.Status, true, out var st))
                query = query.Where(a => a.Status == st);
        }
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim().ToLower();
            query = query.Where(a => a.Name.ToLower().Contains(term) || a.AssetCode.ToLower().Contains(term)
                                     || (a.SerialNumber != null && a.SerialNumber.ToLower().Contains(term))
                                     || (a.AssetType != null && a.AssetType.ToLower().Contains(term)));
        }
        // Sorted in memory (ulong keys can't be ordered by every provider); the register is small.
        var rows = (await query.Take(2000).ToListAsync()).OrderBy(a => a.BranchId).ThenBy(a => a.Zone).ThenBy(a => a.Name).ToList();
        return await MapManyAsync(rows);
    }

    public async Task<AssetDetailDto> GetAsync(ulong id, Func<List<ulong>, Task<List<StaffReportListItem>>>? reports = null)
    {
        var a = await db.FacilityAssets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Asset not found.");
        var dto = new AssetDetailDto();
        Copy((await MapManyAsync([a]))[0], dto);
        var entries = await db.FacilityMaintenances.AsNoTracking().Where(m => m.AssetId == id)
            .OrderByDescending(m => m.PerformedOn).ThenByDescending(m => m.CreatedAt).Take(200).ToListAsync();
        var names = await FacilitiesCommon.NamesAsync(db, entries.Select(e => e.CreatedByUserId));
        dto.Maintenance = entries.Select(m => new MaintenanceDto
        {
            Id = m.Id, PerformedOn = m.PerformedOn, Work = m.Work, PerformedBy = m.PerformedBy, Cost = m.Cost, NextServiceDue = m.NextServiceDue,
            CreatedByName = m.CreatedByUserId is { } u && names.TryGetValue(u, out var n) ? n : null, CreatedAt = m.CreatedAt,
        }).ToList();
        if (reports is not null)
        {
            var ids = await db.FacilityReports.AsNoTracking().Where(r => r.AssetId == id)
                .OrderBy(r => r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress ? 0 : 1)
                .ThenByDescending(r => r.CreatedAt).Select(r => r.Id).Take(20).ToListAsync();
            dto.Reports = await reports(ids);
        }
        return dto;
    }

    public async Task<AssetDto> CreateAsync(AssetRequest r)
    {
        var row = new FacilityAsset { TenantId = TenantId, CreatedByUserId = currentUser.UserId, StatusSince = DateTime.UtcNow };
        await ApplyAsync(row, r);
        db.FacilityAssets.Add(row);
        await db.SaveChangesAsync();
        return (await MapManyAsync([row]))[0];
    }

    public async Task<List<AssetDto>> BulkCreateAsync(BulkAssetRequest r)
    {
        var names = r.Names.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()).ToList();
        if (names.Count == 0 && !string.IsNullOrWhiteSpace(r.BaseName))
        {
            if (r.Count is < 1 or > MaxBulk) throw new ArgumentException($"Add between 1 and {MaxBulk} at a time.");
            var start = Math.Max(0, r.StartAt);
            names = Enumerable.Range(start, r.Count).Select(i => $"{r.BaseName.Trim()} {i}").ToList();
        }
        if (names.Count == 0) throw new ArgumentException("Give the names, or a base name and how many.");
        if (names.Count > MaxBulk) throw new ArgumentException($"Add at most {MaxBulk} at a time.");

        var tenantId = TenantId;
        var rows = new List<FacilityAsset>();
        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in names)
        {
            var row = new FacilityAsset { TenantId = tenantId, CreatedByUserId = currentUser.UserId, StatusSince = DateTime.UtcNow };
            await ApplyAsync(row, new AssetRequest
            {
                BranchId = r.BranchId, Name = name, AssetType = r.AssetType, EquipmentId = r.EquipmentId, Zone = r.Zone, IsKeyFacility = r.IsKeyFacility,
            }, codes);
            codes.Add(row.AssetCode);
            rows.Add(row);
        }
        db.FacilityAssets.AddRange(rows);
        await db.SaveChangesAsync();
        return await MapManyAsync(rows);
    }

    public async Task<AssetDto> UpdateAsync(ulong id, AssetRequest r)
    {
        var row = await db.FacilityAssets.FirstOrDefaultAsync(a => a.Id == id) ?? throw new KeyNotFoundException("Asset not found.");
        await ApplyAsync(row, r);
        await db.SaveChangesAsync();
        return (await MapManyAsync([row]))[0];
    }

    /// <summary>Removes the asset from the floor (kept for its history); its open reports stay in the queue.</summary>
    public async Task<bool> ArchiveAsync(ulong id)
    {
        var row = await db.FacilityAssets.FirstOrDefaultAsync(a => a.Id == id);
        if (row is null) return false;
        row.ArchivedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<SetAssetStatusResponse> SetStatusAsync(ulong id, SetAssetStatusRequest r)
    {
        if (!Enum.TryParse<AssetStatus>(r.Status, true, out var status))
            throw new ArgumentException("Status must be InService, Limited or OutOfService.");
        var row = await db.FacilityAssets.FirstOrDefaultAsync(a => a.Id == id && a.ArchivedAt == null) ?? throw new KeyNotFoundException("Asset not found.");
        var reason = FacilitiesCommon.Clean(r.Reason, 500, "The reason");
        var response = new SetAssetStatusResponse();
        var now = DateTime.UtcNow;

        if (status != row.Status) { row.StatusSince = now; row.StatusChangedByUserId = currentUser.UserId; }
        row.Status = status;
        row.StatusReason = status == AssetStatus.InService ? null : reason;
        row.ExpectedBackOn = status == AssetStatus.InService ? null : r.ExpectedBackOn;

        if (status == AssetStatus.InService)
        {
            // Our own notice ends with the outage.
            if (row.ServiceStatusId is { } noticeId)
            {
                try { await serviceStatus.EndAsync(noticeId); response.ServiceStatusEnded = true; }
                catch (KeyNotFoundException) { /* deleted by staff meanwhile */ }
                row.ServiceStatusId = null;
            }
            if (r.ResolveOpenReports)
            {
                var note = FacilitiesCommon.Clean(r.ResolutionNote, 1000, "The note") ?? $"{row.Name} is back in service.";
                var open = await db.FacilityReports.Where(x => x.AssetId == row.Id && (x.Status == ReportStatus.Received || x.Status == ReportStatus.InProgress)).ToListAsync();
                foreach (var rep in open)
                {
                    rep.Status = ReportStatus.Fixed;
                    rep.ResolutionNote = note;
                    rep.ResolvedAt = now;
                    rep.ResolvedByUserId = currentUser.UserId;
                    rep.LastActivityAt = now;
                    await FacilitiesCommon.NotifyClosedAsync(db, notifier, rep, row.Name);
                }
                response.ReportsResolved = open.Count;
            }
        }
        else if (row.IsKeyFacility && row.ServiceStatusId is null)
        {
            if (r.PostServiceNotice)
            {
                await db.SaveChangesAsync();
                var notice = await serviceStatus.CreateAsync(new ServiceStatusRequest
                {
                    BranchId = row.BranchId, Area = row.Name.Length > 80 ? row.Name[..80] : row.Name,
                    Status = status == AssetStatus.OutOfService ? "Closed" : "Limited",
                    Severity = status == AssetStatus.OutOfService ? "Warning" : "Info",
                    Message = FacilitiesCommon.Clean(r.NoticeMessage, 500, "The notice") ?? DefaultNotice(row.Name, status, reason, row.ExpectedBackOn),
                });
                row.ServiceStatusId = notice.Id;
                response.ServiceStatusPostedId = notice.Id;
            }
            else response.OfferServiceNotice = true;
        }

        await db.SaveChangesAsync();
        response.Asset = (await MapManyAsync([row]))[0];
        return response;
    }

    public static string DefaultNotice(string name, AssetStatus status, string? reason, DateOnly? back)
    {
        var what = status == AssetStatus.OutOfService ? "closed" : "partly available";
        var why = reason is null ? "" : $": {reason.TrimEnd('.')}";
        var when = back is { } d ? $" Expected back {d:ddd d MMM}." : "";
        var text = $"{name} is {what}{why}.{when}";
        return text.Length > 500 ? text[..500] : text;
    }

    public async Task<MaintenanceDto> AddMaintenanceAsync(ulong assetId, MaintenanceRequest r)
    {
        var asset = await db.FacilityAssets.FirstOrDefaultAsync(a => a.Id == assetId) ?? throw new KeyNotFoundException("Asset not found.");
        var work = FacilitiesCommon.Clean(r.Work, 2000, "What was done") ?? throw new ArgumentException("Say what was done.");
        if (r.PerformedOn == default) throw new ArgumentException("Pick the date.");
        if (r.Cost is < 0) throw new ArgumentException("The cost can't be negative.");
        var row = new FacilityMaintenance
        {
            TenantId = asset.TenantId, AssetId = asset.Id, PerformedOn = r.PerformedOn, Work = work,
            PerformedBy = FacilitiesCommon.Clean(r.PerformedBy, 150, "Who did it"), Cost = r.Cost, NextServiceDue = r.NextServiceDue,
            CreatedByUserId = currentUser.UserId,
        };
        db.FacilityMaintenances.Add(row);
        if (asset.LastServicedOn is null || r.PerformedOn >= asset.LastServicedOn)
        {
            asset.LastServicedOn = r.PerformedOn;
            if (r.NextServiceDue is not null) asset.NextServiceDue = r.NextServiceDue;
        }
        await db.SaveChangesAsync();
        return new MaintenanceDto
        {
            Id = row.Id, PerformedOn = row.PerformedOn, Work = row.Work, PerformedBy = row.PerformedBy, Cost = row.Cost,
            NextServiceDue = row.NextServiceDue, CreatedAt = row.CreatedAt,
        };
    }

    public async Task<bool> DeleteMaintenanceAsync(ulong assetId, ulong entryId)
    {
        var row = await db.FacilityMaintenances.FirstOrDefaultAsync(m => m.Id == entryId && m.AssetId == assetId);
        if (row is null) return false;
        db.FacilityMaintenances.Remove(row);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<string>> ZonesAsync(ulong? branchId) =>
        await db.FacilityAssets.AsNoTracking()
            .Where(a => a.ArchivedAt == null && a.Zone != null && (branchId == null || a.BranchId == branchId))
            .Select(a => a.Zone!).Distinct().OrderBy(z => z).ToListAsync();

    public Task<FacilitiesSettings> GetSettingsAsync() => FacilitiesCommon.LoadSettingsAsync(db, TenantId);

    public Task<FacilitiesSettings> UpdateSettingsAsync(FacilitiesSettings s) => FacilitiesCommon.SaveSettingsAsync(db, TenantId, s);

    // ═════════════════════════════ Members / trainers ═════════════════════════════

    /// <summary>What the "Report a problem" picker shows for a branch: its assets grouped by zone.</summary>
    public async Task<ReportOptionsResponse> ReportOptionsAsync(ulong branchId)
    {
        var branch = await db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId) ?? throw new KeyNotFoundException("Branch not found.");
        var settings = await FacilitiesCommon.LoadSettingsAsync(db, TenantId);
        var assets = await db.FacilityAssets.AsNoTracking().Where(a => a.BranchId == branchId && a.ArchivedAt == null)
            .OrderBy(a => a.Zone).ThenBy(a => a.Name).ToListAsync();
        var ids = assets.Select(a => a.Id).ToList();
        var reported = (await db.FacilityReports.AsNoTracking()
            .Where(r => r.AssetId != null && ids.Contains(r.AssetId.Value) && (r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress))
            .Select(r => r.AssetId!.Value).Distinct().ToListAsync()).ToHashSet();

        return new ReportOptionsResponse
        {
            BranchId = branch.Id, BranchName = branch.Name, CanReport = CanReport(settings), MaxPhotos = FacilitiesCommon.MaxPhotos,
            Zones = assets.GroupBy(a => string.IsNullOrWhiteSpace(a.Zone) ? "Other" : a.Zone!)
                .OrderBy(g => g.Key == "Other" ? 1 : 0).ThenBy(g => g.Key)
                .Select(g => new AssetZoneGroup { Zone = g.Key, Assets = g.Select(a => Pick(a, reported.Contains(a.Id))).ToList() }).ToList(),
            ProblemTypes = ProblemTypes.All.Select(t => new ProblemTypeOption { Key = t, Label = ProblemTypes.Label(t), Urgent = t == ProblemTypes.Unsafe }).ToList(),
        };
    }

    /// <summary>The asset a scanned QR label names.</summary>
    public async Task<AssetPickItem> ByCodeAsync(string code)
    {
        var c = (code ?? "").Trim();
        var a = await db.FacilityAssets.AsNoTracking().FirstOrDefaultAsync(x => x.AssetCode == c && x.ArchivedAt == null)
                ?? throw new KeyNotFoundException("No machine has this code.");
        var open = await db.FacilityReports.AnyAsync(r => r.AssetId == a.Id && (r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress));
        return Pick(a, open);
    }

    /// <summary>Non-key machines that are down at a branch (key facilities appear as service-status notices instead).</summary>
    public async Task<List<OutOfServiceItem>> OutOfServiceAsync(ulong branchId)
    {
        if (!(await FacilitiesCommon.LoadSettingsAsync(db, TenantId)).ShowOutOfServiceToMembers) return [];
        return await db.FacilityAssets.AsNoTracking()
            .Where(a => a.BranchId == branchId && a.ArchivedAt == null && !a.IsKeyFacility && a.Status != AssetStatus.InService)
            .OrderBy(a => a.Name).Take(20)
            .Select(a => new OutOfServiceItem { Id = a.Id, Name = a.Name, Zone = a.Zone, Status = a.Status.ToString(), ExpectedBackOn = a.ExpectedBackOn })
            .ToListAsync();
    }

    internal bool CanReport(FacilitiesSettings s) =>
        currentUser.Role.Equals(RoleNames.Client, StringComparison.OrdinalIgnoreCase) ? s.MembersCanReport
        : currentUser.Role.Equals(RoleNames.Trainer, StringComparison.OrdinalIgnoreCase) ? s.TrainersCanReport
        : true;

    // ═════════════════════════════ Helpers ═════════════════════════════

    private async Task ApplyAsync(FacilityAsset row, AssetRequest r, HashSet<string>? reserved = null)
    {
        var name = FacilitiesCommon.Clean(r.Name, 120, "The name") ?? throw new ArgumentException("Give the asset a name.");
        if (!await db.Branches.AnyAsync(b => b.Id == r.BranchId)) throw new ArgumentException("Branch not found.");
        if (r.EquipmentId is { } eq && !await db.Equipment.AnyAsync(e => e.Id == eq)) throw new ArgumentException("Equipment type not found.");

        var code = FacilitiesCommon.Clean(r.AssetCode, 40, "The asset code")?.ToUpperInvariant();
        if (code is not null)
        {
            if (!code.All(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_'))
                throw new ArgumentException("The asset code can only use letters, numbers, '-' and '_'.");
            if (await db.FacilityAssets.AnyAsync(a => a.AssetCode == code && a.Id != row.Id) || reserved?.Contains(code) == true)
                throw RuleException.Conflict($"Another asset already has the code {code}.");
        }
        else if (string.IsNullOrEmpty(row.AssetCode))
        {
            do code = NewCode(); while (reserved?.Contains(code) == true || await db.FacilityAssets.AnyAsync(a => a.AssetCode == code));
        }

        row.BranchId = r.BranchId;
        row.Name = name;
        row.AssetType = FacilitiesCommon.Clean(r.AssetType, 80, "The type");
        row.EquipmentId = r.EquipmentId;
        row.Zone = FacilitiesCommon.Clean(r.Zone, 80, "The zone");
        row.PhotoUrl = FacilitiesCommon.JoinUrls(r.PhotoUrl is null ? [] : [r.PhotoUrl], 1, "photos");
        row.SerialNumber = FacilitiesCommon.Clean(r.SerialNumber, 120, "The serial number");
        if (code is not null) row.AssetCode = code;
        row.IsKeyFacility = r.IsKeyFacility;
        row.NextServiceDue = r.NextServiceDue ?? row.NextServiceDue;
        row.Notes = FacilitiesCommon.Clean(r.Notes, 2000, "Notes");
    }

    private const string CodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private static string NewCode() =>
        "GB-" + new string(Enumerable.Range(0, 6).Select(_ => CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)]).ToArray());

    private static AssetPickItem Pick(FacilityAsset a, bool open) => new()
    {
        Id = a.Id, BranchId = a.BranchId, Name = a.Name, AssetType = a.AssetType, Zone = a.Zone, PhotoUrl = a.PhotoUrl,
        Status = a.Status.ToString(), ExpectedBackOn = a.ExpectedBackOn, HasOpenReport = open,
    };

    private async Task<List<AssetDto>> MapManyAsync(List<FacilityAsset> rows)
    {
        if (rows.Count == 0) return [];
        var branches = await FacilitiesCommon.BranchNamesAsync(db, rows.Select(r => r.BranchId));
        var eqIds = rows.Where(r => r.EquipmentId != null).Select(r => r.EquipmentId!.Value).Distinct().ToList();
        var eqNames = eqIds.Count == 0 ? [] : await db.Equipment.Where(e => eqIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.Name);
        var ids = rows.Select(r => r.Id).ToList();
        var open = await db.FacilityReports.AsNoTracking()
            .Where(r => r.AssetId != null && ids.Contains(r.AssetId.Value) && (r.Status == ReportStatus.Received || r.Status == ReportStatus.InProgress))
            .GroupBy(r => r.AssetId!.Value).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return rows.Select(a => new AssetDto
        {
            Id = a.Id, BranchId = a.BranchId, BranchName = branches.GetValueOrDefault(a.BranchId), Name = a.Name, AssetType = a.AssetType,
            EquipmentId = a.EquipmentId, EquipmentName = a.EquipmentId is { } e && eqNames.TryGetValue(e, out var en) ? en : null,
            Zone = a.Zone, PhotoUrl = a.PhotoUrl, SerialNumber = a.SerialNumber, AssetCode = a.AssetCode, IsKeyFacility = a.IsKeyFacility,
            Status = a.Status.ToString(), StatusReason = a.StatusReason, StatusSince = a.StatusSince, ExpectedBackOn = a.ExpectedBackOn,
            ServiceStatusId = a.ServiceStatusId, LastServicedOn = a.LastServicedOn, NextServiceDue = a.NextServiceDue,
            ServiceOverdue = a.NextServiceDue is { } due && due < today, Notes = a.Notes, IsArchived = a.ArchivedAt != null,
            OpenReports = open.GetValueOrDefault(a.Id),
        }).ToList();
    }

    private static void Copy(AssetDto from, AssetDto to)
    {
        foreach (var p in typeof(AssetDto).GetProperties()) p.SetValue(to, p.GetValue(from));
    }
}
