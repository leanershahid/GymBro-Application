using System.Text.Json;
using GymManagmentApplication.Application.AiCoach.Interfaces;
using GymManagmentApplication.Application.AiCoach.Requests;
using GymManagmentApplication.Application.AiCoach.Responses;
using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.AiCoach.Services;

public class AiCoachSettingsService(AppDbContext db) : IAiCoachSettingsService
{
    private const string SettingKey = "ai-coach-tips";

    private static readonly AiCoachSettingsResponse Defaults = new()
    {
        HighTip = "Push hard today — I've added an extra set to your next session.",
        MediumTip = "Solid recovery. A moderate session will keep you on track.",
        LowTip = "Recovery is low — consider an active-rest or mobility day."
    };

    public async Task<AiCoachSettingsResponse> GetSettingsAsync()
    {
        var tenantId = await DefaultTenantIdAsync();
        var setting = await db.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);

        if (setting?.Value is null) return Defaults;

        try
        {
            var parsed = setting.Value.Deserialize<AiCoachSettingsResponse>();
            return parsed ?? Defaults;
        }
        catch (JsonException)
        {
            return Defaults;
        }
    }

    public async Task<AiCoachSettingsResponse> SaveSettingsAsync(AiCoachSettingsRequest request)
    {
        var tenantId = await DefaultTenantIdAsync();
        var setting = await db.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);

        var response = new AiCoachSettingsResponse
        {
            HighTip = request.HighTip,
            MediumTip = request.MediumTip,
            LowTip = request.LowTip
        };
        var json = JsonDocument.Parse(JsonSerializer.Serialize(response));

        if (setting is null)
        {
            setting = new TenantSetting
            {
                Id = await NextIdAsync(),
                TenantId = tenantId,
                Key = SettingKey,
                Value = json,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            db.TenantSettings.Add(setting);
        }
        else
        {
            setting.Value = json;
            setting.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return response;
    }

    public async Task<string?> GetTipForScoreAsync(byte? recoveryScore)
    {
        if (recoveryScore is null) return null;

        var settings = await GetSettingsAsync();
        return recoveryScore >= 80 ? settings.HighTip
             : recoveryScore >= 50 ? settings.MediumTip
             : settings.LowTip;
    }

    private async Task<ulong> DefaultTenantIdAsync() =>
        await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstAsync();

    private async Task<ulong> NextIdAsync() =>
        (await db.TenantSettings.MaxAsync(s => (ulong?)s.Id) ?? 0) + 1;
}
