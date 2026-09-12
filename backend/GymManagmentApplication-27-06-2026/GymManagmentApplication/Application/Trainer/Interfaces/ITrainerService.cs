using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Application.Trainer.Responses;

namespace GymManagmentApplication.Application.Trainer.Interfaces;

public interface ITrainerService
{
    Task<PagedResponse<TrainerResponse>> GetAllAsync(int pageNumber, int pageSize);
    Task<TrainerResponse> CreateAsync(CreateTrainerRequest request);
    Task<TrainerResponse?> GetByIdAsync(ulong id);
    Task<TrainerResponse?> UpdateAsync(ulong id, UpdateTrainerRequest request);
    Task<List<TrainerClientResponse>> GetClientsAsync(ulong id);
    Task<TrainerClientResponse> AssignClientAsync(ulong id, AssignClientRequest request);
    Task<bool> UnassignClientAsync(ulong trainerId, ulong clientId);
    Task<List<TrainerScheduleResponse>> GetScheduleAsync(ulong id);
    Task<bool> SetScheduleAsync(ulong id, SetScheduleRequest request);
    Task<TrainerPerformanceResponse> GetPerformanceAsync(ulong id);
    Task<TrainerEarningsResponse> GetEarningsAsync(ulong id, int month, int year);
    Task<TrainerResponse?> AutoAssignAsync(ulong clientId, ulong branchId);
}
