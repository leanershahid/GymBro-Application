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

/// <summary>A member's tags (ARCH-023).</summary>
public class MemberTagsService(ICurrentUser currentUser, IAppDbContext db)
{
    /// <summary>
    /// Loads a member the caller may act on (see <see cref="MemberScope"/>): clients only
    /// themselves, trainers only their assigned clients, super admin accounts only by a
    /// super admin. Throws (→ 403) otherwise; null when not found in the caller's gym.
    /// </summary>
    private Task<User?> GetAccessibleAsync(ulong id) => db.GetActionableUserAsync(currentUser, id);

    public async Task<List<string>> GetTagsAsync(ulong id)
    {
        if (await GetAccessibleAsync(id) is null) return [];
        return await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .Include(t => t.Tag)
            .Select(t => t.Tag.Name)
            .ToListAsync();
    }

    public async Task<bool> AssignTagsAsync(ulong id, AssignTagsRequest request)
    {
        var member = await GetAccessibleAsync(id) ?? throw new KeyNotFoundException($"Member {id} not found.");

        // Remove existing tags for this member
        var existing = await db.Taggables
            .Where(t => t.TaggableType == "User" && t.TaggableId == id)
            .ToListAsync();
        db.Taggables.RemoveRange(existing);

        var tenantId = member.TenantId;

        // Get or create the tags with one read and one save (ARCH-042); new tags get their id on Add.
        var names = request.Tags.Distinct().ToList();
        var tags = await db.Tags.Where(t => t.TenantId == tenantId && names.Contains(t.Name)).ToListAsync();
        foreach (var tagName in names)
        {
            var tag = tags.FirstOrDefault(t => t.Name == tagName);
            if (tag is null)
            {
                tag = new Tag { TenantId = tenantId, Name = tagName };
                db.Tags.Add(tag);
                tags.Add(tag);
            }
            db.Taggables.Add(new Taggable { TagId = tag.Id, TaggableId = id, TaggableType = "User" });
        }

        await db.SaveChangesAsync();
        return true;
    }
}
