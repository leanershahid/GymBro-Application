using GymManagmentApplication.Application.Challenges.Requests;
using GymManagmentApplication.Application.Challenges.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Gamification;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Challenges.Services;

/// <summary>
/// Taking part in a challenge: detail with leaderboard, join/leave, progress, and the admin's
/// edit of an existing challenge (ARCH-077: moved here from Engagement's EngagementService, so all
/// challenge logic lives under Challenges; <see cref="ChallengesService"/> keeps listing/creation).
/// </summary>
public class ChallengeParticipationService(IAppDbContext db, ICurrentUser currentUser)
{
    private ulong Me => currentUser.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");

    public async Task<ChallengeDetailResponse> GetChallengeAsync(ulong id)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (currentUser.IsClient() && c.Status == ChallengeStatus.Draft) throw new KeyNotFoundException("Challenge not found.");
        var parts = await db.ChallengeParticipants.Include(p => p.User).Where(p => p.ChallengeId == id)
            .OrderByDescending(p => p.Progress).ThenBy(p => p.JoinedAt).ToListAsync();
        var me = currentUser.UserId;
        var board = parts.Select((p, i) => new LeaderboardEntry
        {
            Rank = i + 1, UserId = p.UserId, Name = $"{p.User.FirstName} {(p.User.LastName ?? "").FirstOrDefault()}".Trim().TrimEnd(' '),
            Progress = p.Progress, ProgressPct = Pct(p.Progress, c.TargetValue), IsMe = p.UserId == me,
        }).ToList();
        var mine = board.FirstOrDefault(b => b.IsMe);
        return new ChallengeDetailResponse
        {
            Id = c.Id, Title = c.Title, Description = c.Description, Metric = c.Metric, TargetValue = c.TargetValue,
            StartsAt = c.StartsAt, EndsAt = c.EndsAt, Status = c.Status.ToString(), ParticipantCount = parts.Count,
            IsJoined = mine is not null, MyProgress = mine?.Progress ?? 0, MyRank = mine?.Rank,
            // Top 20, plus the caller's own row if they're further down.
            Leaderboard = board.Take(20).Concat(mine is { Rank: > 20 } ? [mine] : []).ToList(),
        };
    }

    public async Task<ChallengeDetailResponse> JoinAsync(ulong id)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (c.Status != ChallengeStatus.Active || c.EndsAt < DateTime.UtcNow) throw new ArgumentException("This challenge isn't open for joining.");
        if (!await db.ChallengeParticipants.AnyAsync(p => p.ChallengeId == id && p.UserId == Me))
        {
            db.ChallengeParticipants.Add(new ChallengeParticipant { TenantId = c.TenantId, ChallengeId = id, UserId = Me });
            await db.SaveChangesAsync();
        }
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> LeaveAsync(ulong id)
    {
        await db.ChallengeParticipants.Where(p => p.ChallengeId == id && p.UserId == Me).ExecuteDeleteAsync();
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> LogProgressAsync(ulong id, ChallengeProgressRequest r)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        var now = DateTime.UtcNow;
        if (c.Status != ChallengeStatus.Active || now < c.StartsAt || now > c.EndsAt)
            throw new ArgumentException("Progress can only be logged while the challenge is running.");
        if (r.Value < 0 || (!r.Set && r.Value == 0)) throw new ArgumentException("Enter a positive amount.");
        var p = await db.ChallengeParticipants.FirstOrDefaultAsync(x => x.ChallengeId == id && x.UserId == Me)
                ?? throw new ArgumentException("Join the challenge first.");
        p.Progress = r.Set ? r.Value : p.Progress + r.Value;
        await db.SaveChangesAsync();
        await RerankAsync(id);
        return await GetChallengeAsync(id);
    }

    public async Task<ChallengeDetailResponse> UpdateChallengeAsync(ulong id, UpdateChallengeRequest r)
    {
        var c = await db.Challenges.FirstOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Challenge not found.");
        if (r.Title is not null)
        {
            if (string.IsNullOrWhiteSpace(r.Title)) throw new ArgumentException("Give the challenge a title.");
            c.Title = r.Title.Trim();
        }
        if (r.Description is not null) c.Description = r.Description.Trim();
        if (r.Metric is not null) c.Metric = r.Metric.Trim();
        if (r.TargetValue is not null) c.TargetValue = r.TargetValue <= 0 ? null : r.TargetValue;
        if (r.StartsAt is { } s) c.StartsAt = s;
        if (r.EndsAt is { } e) c.EndsAt = e;
        if (c.EndsAt <= c.StartsAt) throw new ArgumentException("The end must be after the start.");
        await db.SaveChangesAsync();
        return await GetChallengeAsync(id);
    }

    private async Task RerankAsync(ulong challengeId)
    {
        var parts = await db.ChallengeParticipants.Where(p => p.ChallengeId == challengeId)
            .OrderByDescending(p => p.Progress).ThenBy(p => p.JoinedAt).ToListAsync();
        for (var i = 0; i < parts.Count; i++) parts[i].Rank = (ushort)(i + 1);
        await db.SaveChangesAsync();
    }

    private static double Pct(decimal progress, decimal? target) =>
        target is > 0 ? Math.Round(Math.Clamp((double)(progress / target.Value * 100), 0, 100), 1) : 0;
}
