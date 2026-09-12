using GymManagmentApplication.Application.AiCoach.Requests;
using GymManagmentApplication.Application.AiCoach.Responses;

namespace GymManagmentApplication.Application.AiCoach.Interfaces;

public interface IAiCoachSettingsService
{
    Task<AiCoachSettingsResponse> GetSettingsAsync();
    Task<AiCoachSettingsResponse> SaveSettingsAsync(AiCoachSettingsRequest request);

    /// <summary>Buckets a recovery score into the matching tip, or null if no score exists yet.</summary>
    Task<string?> GetTipForScoreAsync(byte? recoveryScore);
}
