using GymManagmentApplication.Application.Challenges.Requests;
using GymManagmentApplication.Application.Challenges.Responses;

namespace GymManagmentApplication.Application.Challenges.Interfaces;

public interface IChallengesService
{
    Task<List<ActiveChallengeResponse>> GetActiveAsync(ulong userId);
    Task<List<ChallengeAdminResponse>> GetAllAsync();
    Task<ChallengeAdminResponse> CreateAsync(CreateChallengeRequest request);
    Task<ChallengeAdminResponse?> SetStatusAsync(ulong id, UpdateChallengeStatusRequest request);
}
