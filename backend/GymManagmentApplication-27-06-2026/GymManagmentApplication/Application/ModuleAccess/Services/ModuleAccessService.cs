using GymManagmentApplication.Application.ModuleAccess.Interfaces;
using GymManagmentApplication.Application.ModuleAccess.Requests;
using GymManagmentApplication.Application.ModuleAccess.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.ModuleAccess.Services;

public class ModuleAccessService(AppDbContext db) : IModuleAccessService
{
    // All module keys the platform exposes — used for validation and matrix generation
    private static readonly List<string> _availableModules =
    [
        "members", "trainers", "leads", "onboarding", "corporate",
        "exercises", "workouts", "plans", "workout-automation",
        "branches", "tenants", "roles",
        "billing", "payments", "invoices", "subscriptions",
        "classes", "attendance", "pt-sessions",
        "analytics", "reports",
        "notifications", "campaigns",
        "automations", "webhooks",
        "integrations", "api-keys",
        "ai-insights",
        "gamification", "social",
        "media", "forms",
        "settings"
    ];

    public List<string> GetAvailableModules() => _availableModules;

    public async Task<List<ModuleAccessResponse>> GetByRoleAsync(ulong tenantId, ulong roleId)
    {
        var entries = await db.ModuleAccesses
            .Include(m => m.Role)
            .Where(m => m.TenantId == tenantId && m.RoleId == roleId && m.IsActive)
            .OrderBy(m => m.Module)
            .ToListAsync();

        return entries.Select(Map).ToList();
    }

    public async Task<ModuleAccessMatrixResponse> GetMatrixAsync(ulong tenantId)
    {
        var entries = await db.ModuleAccesses
            .Include(m => m.Role)
            .Where(m => m.TenantId == tenantId && m.IsActive)
            .OrderBy(m => m.Module).ThenBy(m => m.Role.Name)
            .ToListAsync();

        var matrix = entries
            .GroupBy(m => m.Module)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new RoleModuleRow
                {
                    RoleId = m.RoleId,
                    RoleName = m.Role?.Name ?? m.RoleId.ToString(),
                    CanView = m.CanView,
                    CanCreate = m.CanCreate,
                    CanEdit = m.CanEdit,
                    CanDelete = m.CanDelete,
                    CanExport = m.CanExport
                }).ToList()
            );

        return new ModuleAccessMatrixResponse { TenantId = tenantId, Matrix = matrix };
    }

    public async Task<ModuleAccessResponse> SetAsync(SetModuleAccessRequest request)
    {
        var existing = await db.ModuleAccesses
            .Include(m => m.Role)
            .FirstOrDefaultAsync(m =>
                m.TenantId == request.TenantId &&
                m.RoleId == request.RoleId &&
                m.Module == request.Module);

        if (existing is null)
        {
            existing = new Domain.Entities.Identity.ModuleAccess
            {
                Id = await NextIdAsync(),
                TenantId = request.TenantId,
                RoleId = request.RoleId,
                Module = request.Module
            };
            db.ModuleAccesses.Add(existing);
        }

        existing.CanView = request.CanView;
        existing.CanCreate = request.CanCreate;
        existing.CanEdit = request.CanEdit;
        existing.CanDelete = request.CanDelete;
        existing.CanExport = request.CanExport;
        existing.IsActive = true;
        existing.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        // Reload with Role nav to get role name
        await db.Entry(existing).Reference(m => m.Role).LoadAsync();
        return Map(existing);
    }

    public async Task<List<ModuleAccessResponse>> BulkSetAsync(BulkSetModuleAccessRequest request)
    {
        var results = new List<ModuleAccessResponse>();
        foreach (var entry in request.Modules)
        {
            var result = await SetAsync(new SetModuleAccessRequest
            {
                TenantId = request.TenantId,
                RoleId = request.RoleId,
                Module = entry.Module,
                CanView = entry.CanView,
                CanCreate = entry.CanCreate,
                CanEdit = entry.CanEdit,
                CanDelete = entry.CanDelete,
                CanExport = entry.CanExport
            });
            results.Add(result);
        }
        return results;
    }

    public async Task<bool> RevokeAsync(ulong tenantId, ulong roleId, string module)
    {
        var entry = await db.ModuleAccesses
            .FirstOrDefaultAsync(m => m.TenantId == tenantId && m.RoleId == roleId && m.Module == module);

        if (entry is null) return false;

        db.ModuleAccesses.Remove(entry);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RevokeAllForRoleAsync(ulong tenantId, ulong roleId)
    {
        var entries = await db.ModuleAccesses
            .Where(m => m.TenantId == tenantId && m.RoleId == roleId)
            .ToListAsync();

        if (entries.Count == 0) return false;

        db.ModuleAccesses.RemoveRange(entries);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<CheckAccessResponse> CheckAsync(ulong tenantId, CheckModuleAccessRequest request)
    {
        var entry = await db.ModuleAccesses
            .FirstOrDefaultAsync(m =>
                m.TenantId == tenantId &&
                m.RoleId == request.RoleId &&
                m.Module == request.Module &&
                m.IsActive);

        bool allowed = false;
        if (entry is not null)
        {
            allowed = request.Action.ToLower() switch
            {
                "view"   => entry.CanView,
                "create" => entry.CanCreate,
                "edit"   => entry.CanEdit,
                "delete" => entry.CanDelete,
                "export" => entry.CanExport,
                _        => false
            };
        }

        return new CheckAccessResponse
        {
            RoleId = request.RoleId,
            Module = request.Module,
            Action = request.Action,
            IsAllowed = allowed
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static ModuleAccessResponse Map(Domain.Entities.Identity.ModuleAccess m) => new()
    {
        Id = m.Id,
        TenantId = m.TenantId,
        RoleId = m.RoleId,
        RoleName = m.Role?.Name ?? m.RoleId.ToString(),
        Module = m.Module,
        CanView = m.CanView,
        CanCreate = m.CanCreate,
        CanEdit = m.CanEdit,
        CanDelete = m.CanDelete,
        CanExport = m.CanExport,
        IsActive = m.IsActive,
        UpdatedAt = m.UpdatedAt
    };

    private async Task<ulong> NextIdAsync()
    {
        var max = await db.ModuleAccesses.MaxAsync(m => (ulong?)m.Id) ?? 0;
        return max + 1;
    }
}
