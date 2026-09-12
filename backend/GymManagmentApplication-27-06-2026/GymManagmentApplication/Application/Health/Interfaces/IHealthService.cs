using GymManagmentApplication.Application.Health.Responses;

namespace GymManagmentApplication.Application.Health.Interfaces;

public interface IHealthService
{
    Task<HealthTodayResponse> GetTodayAsync(ulong clientId);
    Task<HealthAdminOverviewResponse> GetAdminOverviewAsync();
}
