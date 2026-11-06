using System.Text.Json;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Application.Member.Responses;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Member.Services;

/// <summary>Staff notes on a member, kept as AuditLog rows (ARCH-023).</summary>
public class MemberNotesService(ICurrentUser currentUser, IAppDbContext db)
{
    /// <summary>
    /// Loads a member the caller may act on (see <see cref="MemberScope"/>): clients only
    /// themselves, trainers only their assigned clients, super admin accounts only by a
    /// super admin. Throws (→ 403) otherwise; null when not found in the caller's gym.
    /// </summary>
    private Task<User?> GetAccessibleAsync(ulong id) => db.GetActionableUserAsync(currentUser, id);

    public async Task<List<MemberNoteResponse>> GetNotesAsync(ulong id)
    {
        var member = await GetAccessibleAsync(id);
        if (member is null) return [];
        var notes = await db.AuditLogs
            .Where(a => a.EntityType == "MemberNote" && a.EntityId == id && a.TenantId == member.TenantId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return notes.Select(a => new MemberNoteResponse
        {
            Id = a.Id,
            Note = a.NewValues != null
                ? a.NewValues.RootElement.GetProperty("note").GetString() ?? string.Empty
                : string.Empty,
            TrainerId =(ulong) a.UserId,
            CreatedAt = a.CreatedAt
        }).ToList();
    }

    public async Task<MemberNoteResponse> AddNoteAsync(ulong id, AddMemberNoteRequest request)
    {
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");
        var authorId = currentUser.UserId ?? 0;
        var entry = new AuditLog
        {
            TenantId = member.TenantId,
            EntityType = "MemberNote",
            EntityId = id,
            Action = "create",
            UserId = authorId,
            NewValues = JsonDocument.Parse(JsonSerializer.Serialize(new { note = request.Note })),
            CreatedAt = DateTime.UtcNow
        };
        db.AuditLogs.Add(entry);
        await db.SaveChangesAsync();

        return new MemberNoteResponse { Id = entry.Id, Note = request.Note, TrainerId = authorId, CreatedAt = entry.CreatedAt };
    }
}
