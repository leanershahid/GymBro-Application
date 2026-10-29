using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Training;

namespace GymManagmentApplication.Infrastructure.Repositories;

public interface ITrainerRepository
{
    Task<(List<TrainerProfile> Items, int Total)> GetAllAsync(int pageNumber, int pageSize, string? search = null);
    Task<TrainerProfile?> GetByIdAsync(ulong id);
    Task<TrainerProfile?> GetByUserIdAsync(ulong userId);
    Task<TrainerProfile> CreateAsync(TrainerProfile trainer);
    Task<TrainerProfile> UpdateAsync(TrainerProfile trainer);
    Task<List<TrainerClientAssignment>> GetClientAssignmentsAsync(ulong trainerId);
    Task<TrainerClientAssignment> AddClientAssignmentAsync(TrainerClientAssignment assignment);
    Task<bool> RemoveClientAssignmentAsync(ulong trainerId, ulong clientId);
    Task<List<TrainerAvailabilitySlot>> GetSlotsAsync(ulong trainerId);
    Task SetSlotsAsync(ulong trainerId, List<TrainerAvailabilitySlot> slots);
    Task<List<TrainerProfile>> GetAvailableTrainersAsync(ulong branchId);
}
