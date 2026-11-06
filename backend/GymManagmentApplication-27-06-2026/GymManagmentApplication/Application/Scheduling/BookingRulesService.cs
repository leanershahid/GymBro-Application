using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Engagement;
using GymManagmentApplication.Application.Safety;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Entities.Scheduling;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Scheduling;

/// <summary>
/// The API side of cancellation and no-show rules: gym settings, the member's own standing,
/// staff views of penalties (class roster, PT session, member detail), waiving and lifting blocks
/// (audit-logged). Enforcement itself lives in <see cref="BookingPenaltyEngine"/>, called from
/// <see cref="ClassService"/> and <see cref="PtService"/>.
/// </summary>
public class BookingRulesService(IAppDbContext db, ICurrentUser currentUser, Notifier notifier)
{
    private readonly BookingPenaltyEngine engine = new(db, notifier);
    private ulong TenantId => currentUser.ResolveTenantId();
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    // ── Settings ────────────────────────────────────────────────────────────

    public async Task<BookingRulesSettingsResponse> GetSettingsAsync()
    {
        var s = await BookingPenaltyEngine.LoadSettingsAsync(db, TenantId);
        return await ToResponseAsync(s);
    }

    public async Task<BookingRulesSettingsResponse> SaveSettingsAsync(BookingRulesSettings request, RequestMeta? meta = null)
    {
        var before = await BookingPenaltyEngine.LoadSettingsAsync(db, TenantId);
        var saved = await BookingPenaltyEngine.SaveSettingsAsync(db, TenantId, request, DateTime.UtcNow);
        Audit("booking_rules.update", "TenantSetting", null, meta, before, saved);
        await db.SaveChangesAsync();
        return await ToResponseAsync(saved);
    }

    public async Task<BookingPolicyResponse> GetPolicyAsync()
    {
        var s = await BookingPenaltyEngine.LoadSettingsAsync(db, TenantId);
        var late = BookingPenaltyEngine.EffectiveLateCancel(s);
        var noShow = BookingPenaltyEngine.EffectiveNoShow(s);
        return new BookingPolicyResponse
        {
            ClassCancelCutoffHours = s.ClassCancelCutoffHours, PtCancelCutoffHours = s.PtCancelCutoffHours,
            LateCancelConsequence = late, LateCancelFee = late == BookingRulesSettings.Fee ? s.LateCancelFee : null,
            NoShowConsequence = noShow, NoShowFee = noShow == BookingRulesSettings.Fee ? s.NoShowFee : null,
            StrikesBeforeBlock = s.StrikesBeforeBlock, StrikeWindowDays = s.StrikeWindowDays, BlockDays = s.BlockDays,
            Currency = await CurrencyAsync(),
        };
    }

    // ── Standing ────────────────────────────────────────────────────────────

    public Task<BookingStandingResponse> GetMyStandingAsync() => StandingAsync(Me, canWaive: false);

    public async Task<BookingStandingResponse> GetMemberStandingAsync(ulong memberId)
    {
        if (!await db.Users.AnyAsync(u => u.Id == memberId)) throw new KeyNotFoundException("Member not found.");
        return await StandingAsync(memberId, await CanWaiveAsync());
    }

    private async Task<BookingStandingResponse> StandingAsync(ulong clientId, bool canWaive)
    {
        var now = DateTime.UtcNow;
        var s = await BookingPenaltyEngine.LoadSettingsAsync(db, TenantId);
        var block = await engine.ActiveBlockAsync(TenantId, clientId, now);
        var rows = await db.BookingPenalties.Where(p => p.ClientId == clientId)
            .OrderByDescending(p => p.CreatedAt).Take(20).ToListAsync();
        return new BookingStandingResponse
        {
            ClientId = clientId,
            Strikes = await engine.CountStrikesAsync(TenantId, clientId, now, s),
            StrikesBeforeBlock = s.StrikesBeforeBlock, StrikeWindowDays = s.StrikeWindowDays,
            StrikesEnabled = BookingPenaltyEngine.EffectiveNoShow(s) == BookingRulesSettings.StrikeOnly,
            ActiveBlock = block is null ? null : MapBlock(block),
            Penalties = await MapManyAsync(rows),
            CanWaive = canWaive,
        };
    }

    // ── Staff: penalties ────────────────────────────────────────────────────

    /// <summary>Penalties for a class (roster), a PT session or a member. Trainers: their own classes / sessions only.</summary>
    public async Task<List<BookingPenaltyResponse>> GetPenaltiesAsync(ulong? classId, ulong? ptSessionId, ulong? memberId)
    {
        if (classId is null && ptSessionId is null && memberId is null)
            throw new ArgumentException("Filter by classId, ptSessionId or memberId.");
        if (currentUser.IsTrainer())
        {
            if (classId is { } cid)
            {
                var teaches = await db.GymClasses.Where(c => c.Id == cid)
                    .Select(c => c.TrainerId == null || c.Trainer!.UserId == currentUser.UserId).FirstOrDefaultAsync();
                if (!teaches) throw new UnauthorizedAccessException("You can only see classes you teach.");
            }
            else if (ptSessionId is { } sid)
            {
                if (!await db.PtSessions.AnyAsync(x => x.Id == sid && x.Trainer.UserId == currentUser.UserId))
                    throw new UnauthorizedAccessException("Not your session.");
            }
            else throw new UnauthorizedAccessException("Trainers can see penalties for their own classes and sessions.");
        }
        var q = db.BookingPenalties.AsQueryable();
        if (classId is { } c) q = q.Where(p => p.ClassId == c);
        if (ptSessionId is { } pt) q = q.Where(p => p.PtSessionId == pt);
        if (memberId is { } m) q = q.Where(p => p.ClientId == m);
        return await MapManyAsync(await q.OrderByDescending(p => p.CreatedAt).Take(200).ToListAsync());
    }

    public async Task<WaivePenaltyResponse> WaiveAsync(ulong id, WaivePenaltyRequest r, RequestMeta? meta = null)
    {
        if (string.IsNullOrWhiteSpace(r.Reason)) throw new ArgumentException("Give a reason for waiving.");
        if (r.Reason.Trim().Length > 500) throw new ArgumentException("Keep the reason under 500 characters.");
        if (!await CanWaiveAsync()) throw new UnauthorizedAccessException("This gym only lets admins waive penalties.");
        return await db.InTransactionAsync(async () =>
        {
            var p = await db.BookingPenalties.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Penalty not found.");
            if (p.Waived) throw RuleException.Conflict("This penalty was already waived.");
            var voided = await engine.WaiveAsync(p, Me, r.Reason, DateTime.UtcNow);
            Audit("booking_penalty.waive", "BookingPenalty", p.Id, meta, new { waived = false },
                new { waived = true, reason = p.WaiveReason, feeInvoiceId = p.FeeInvoiceId, feeVoided = voided });
            await db.SaveChangesAsync();
            return new WaivePenaltyResponse { Penalty = (await MapManyAsync([p]))[0], FeeVoided = voided };
        });
    }

    public async Task<BookingBlockResponse> LiftBlockAsync(ulong id, LiftBlockRequest r, RequestMeta? meta = null)
    {
        if (r.Reason?.Trim().Length > 500) throw new ArgumentException("Keep the reason under 500 characters.");
        if (!await CanWaiveAsync()) throw new UnauthorizedAccessException("This gym only lets admins lift booking blocks.");
        var b = await db.BookingBlocks.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Block not found.");
        if (b.LiftedAt is not null || b.Until <= DateTime.UtcNow) throw RuleException.Conflict("This block has already ended.");
        engine.Lift(b, Me, string.IsNullOrWhiteSpace(r.Reason) ? "Lifted by staff" : r.Reason, DateTime.UtcNow);
        Audit("booking_block.lift", "BookingBlock", b.Id, meta, new { until = b.Until }, new { liftedAt = b.LiftedAt, reason = b.LiftReason });
        await db.SaveChangesAsync();
        return MapBlock(b);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /// <summary>Admins always; delegated staff roles only when the gym allows staff to waive.</summary>
    private async Task<bool> CanWaiveAsync()
    {
        if (currentUser.IsClient() || currentUser.IsTrainer()) return false;
        if (currentUser.IsAdmin) return true;
        return (await BookingPenaltyEngine.LoadSettingsAsync(db, TenantId)).StaffCanWaive;
    }

    private async Task<BookingRulesSettingsResponse> ToResponseAsync(BookingRulesSettings s) => new()
    {
        ClassCancelCutoffHours = s.ClassCancelCutoffHours, PtCancelCutoffHours = s.PtCancelCutoffHours,
        LateCancelConsequence = s.LateCancelConsequence, LateCancelFee = s.LateCancelFee,
        NoShowConsequence = s.NoShowConsequence, NoShowFee = s.NoShowFee,
        StrikesBeforeBlock = s.StrikesBeforeBlock, StrikeWindowDays = s.StrikeWindowDays, BlockDays = s.BlockDays,
        StaffCanWaive = s.StaffCanWaive, AutoNoShowEnabled = s.AutoNoShowEnabled, AutoNoShowAfterMinutes = s.AutoNoShowAfterMinutes,
        AutoNoShowSince = s.AutoNoShowSince,
        CreditsSupported = BookingPenaltyEngine.CreditsSupported, Currency = await CurrencyAsync(),
    };

    private async Task<string> CurrencyAsync() =>
        await db.Tenants.IgnoreQueryFilters().Where(t => t.Id == TenantId).Select(t => t.Currency).FirstOrDefaultAsync() ?? "INR";

    private static BookingBlockResponse MapBlock(BookingBlock b) => new()
    {
        Id = b.Id, From = b.From, Until = b.Until, Reason = b.Reason, LiftedAt = b.LiftedAt, LiftReason = b.LiftReason,
    };

    private async Task<List<BookingPenaltyResponse>> MapManyAsync(List<BookingPenalty> rows)
    {
        if (rows.Count == 0) return [];
        var classIds = rows.Where(r => r.ClassId != null).Select(r => r.ClassId!.Value).Distinct().ToList();
        var ptIds = rows.Where(r => r.PtSessionId != null).Select(r => r.PtSessionId!.Value).Distinct().ToList();
        var invoiceIds = rows.Where(r => r.FeeInvoiceId != null).Select(r => r.FeeInvoiceId!.Value).Distinct().ToList();
        var userIds = rows.Select(r => r.ClientId).Concat(rows.Where(r => r.WaivedBy != null).Select(r => r.WaivedBy!.Value)).Distinct().ToList();

        var classes = await db.GymClasses.Where(c => classIds.Contains(c.Id))
            .Select(c => new { c.Id, Title = c.Title ?? c.ClassType.Name }).ToDictionaryAsync(c => c.Id, c => c.Title);
        var sessions = await db.PtSessions.Where(s => ptIds.Contains(s.Id))
            .Select(s => new { s.Id, s.SessionType.Name }).ToDictionaryAsync(s => s.Id, s => s.Name);
        var invoices = await db.Invoices.Where(i => invoiceIds.Contains(i.Id))
            .Select(i => new { i.Id, i.InvoiceNo, i.Status, i.Currency }).ToDictionaryAsync(i => i.Id);
        var names = await db.Users.IgnoreQueryFilters().Where(u => userIds.Contains(u.Id) && u.TenantId == TenantId)
            .Select(u => new { u.Id, Name = (u.FirstName + " " + u.LastName).Trim() }).ToDictionaryAsync(u => u.Id, u => u.Name);

        return rows.Select(p =>
        {
            var inv = p.FeeInvoiceId is { } iid && invoices.TryGetValue(iid, out var i) ? i : null;
            return new BookingPenaltyResponse
            {
                Id = p.Id, ClientId = p.ClientId, ClientName = names.GetValueOrDefault(p.ClientId), Type = p.Type,
                BookingId = p.BookingId, ClassId = p.ClassId, PtSessionId = p.PtSessionId,
                Label = p.ClassId is { } c ? classes.GetValueOrDefault(c) : p.PtSessionId is { } s ? sessions.GetValueOrDefault(s) : null,
                SessionStartsAt = p.SessionStartsAt, FeeAmount = p.FeeAmount, Currency = inv?.Currency,
                FeeInvoiceId = p.FeeInvoiceId, FeeInvoiceNo = inv?.InvoiceNo, FeeInvoiceStatus = inv?.Status.ToString(),
                Strike = p.Strike, CreatedAt = p.CreatedAt, Waived = p.Waived, WaivedAt = p.WaivedAt,
                WaivedByName = p.WaivedBy is { } w ? names.GetValueOrDefault(w) : null, WaiveReason = p.WaiveReason,
            };
        }).ToList();
    }

    private void Audit(string action, string entityType, ulong? entityId, RequestMeta? meta, object? oldValues, object? newValues) =>
        db.AuditLogs.Add(new AuditLog
        {
            TenantId = TenantId, UserId = currentUser.UserId, Action = action, EntityType = entityType, EntityId = entityId,
            OldValues = oldValues is null ? null : JsonSerializer.SerializeToDocument(oldValues),
            NewValues = newValues is null ? null : JsonSerializer.SerializeToDocument(newValues),
            IpAddress = Truncate(meta?.Ip, 64), UserAgent = Truncate(meta?.UserAgent, 255), CreatedAt = DateTime.UtcNow,
        });

    private static string? Truncate(string? v, int max) => v is null ? null : v.Length <= max ? v : v[..max];
}
