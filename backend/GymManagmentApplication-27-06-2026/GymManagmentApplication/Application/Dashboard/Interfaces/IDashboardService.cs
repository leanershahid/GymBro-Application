using GymManagmentApplication.Application.Dashboard.Responses;

namespace GymManagmentApplication.Application.Dashboard.Interfaces;

public interface IDashboardService
{
    Task<DashboardOverviewResponse> GetOverviewAsync();
}
