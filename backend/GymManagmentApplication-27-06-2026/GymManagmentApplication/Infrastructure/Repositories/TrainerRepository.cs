using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Infrastructure.Repositories;

public class TrainerRepository(AppDbContext db) : ITrainerRepository
{
    public async Task<User> CreateUserAsync(User user)
    {
        user.CreatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<(List<TrainerProfile> Items, int Total)> GetAllAsync(int pageNumber, int pageSize)
    {
        var total = await db.TrainerProfiles.CountAsync();
        var items = await db.TrainerProfiles
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        return (items, total);
    }

    public async Task<TrainerProfile?> GetByIdAsync(ulong id) =>
        await db.TrainerProfiles.FirstOrDefaultAsync(t => t.Id == id);

    public async Task<TrainerProfile> CreateAsync(TrainerProfile trainer)
    {
        trainer.CreatedAt = DateTime.UtcNow;
        trainer.UpdatedAt = DateTime.UtcNow;
        db.TrainerProfiles.Add(trainer);
        await db.SaveChangesAsync();
        return trainer;
    }

    public async Task<TrainerProfile> UpdateAsync(TrainerProfile trainer)
    {
        trainer.UpdatedAt = DateTime.UtcNow;
        db.TrainerProfiles.Update(trainer);
        await db.SaveChangesAsync();
        return trainer;
    }

    public async Task<List<TrainerClientAssignment>> GetClientAssignmentsAsync(ulong trainerId) =>
        await db.TrainerClientAssignments
            .Where(a => a.TrainerId == trainerId && a.Status == TrainerAssignmentStatus.Active)
            .ToListAsync();

    public async Task<TrainerClientAssignment> AddClientAssignmentAsync(TrainerClientAssignment assignment)
    {
        var maxId = await db.TrainerClientAssignments.MaxAsync(a => (ulong?)a.Id) ?? 0;
        assignment.Id = maxId + 1;
        assignment.AssignedAt = DateTime.UtcNow;
        db.TrainerClientAssignments.Add(assignment);
        await db.SaveChangesAsync();
        return assignment;
    }

    public async Task<bool> RemoveClientAssignmentAsync(ulong trainerId, ulong clientId)
    {
        var assignment = await db.TrainerClientAssignments
            .FirstOrDefaultAsync(a => a.TrainerId == trainerId && a.ClientId == clientId && a.Status == TrainerAssignmentStatus.Active);
        if (assignment is null) return false;
        assignment.Status = TrainerAssignmentStatus.Inactive;
        assignment.EndedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<TrainerAvailabilitySlot>> GetSlotsAsync(ulong trainerId) =>
        await db.TrainerAvailabilitySlots
            .Where(s => s.TrainerId == trainerId && s.IsActive)
            .ToListAsync();

    public async Task SetSlotsAsync(ulong trainerId, List<TrainerAvailabilitySlot> slots)
    {
        var existing = await db.TrainerAvailabilitySlots
            .Where(s => s.TrainerId == trainerId)
            .ToListAsync();
        db.TrainerAvailabilitySlots.RemoveRange(existing);
        foreach (var s in slots) s.TrainerId = trainerId;
        db.TrainerAvailabilitySlots.AddRange(slots);
        await db.SaveChangesAsync();
    }

    public async Task<List<TrainerProfile>> GetAvailableTrainersAsync(ulong branchId) =>
        await db.TrainerProfiles
            .Where(t => t.BranchId == branchId && t.IsAvailable)
            .ToListAsync();
}
