using GymManagmentApplication.Application.Member.Requests;
using GymManagmentApplication.Domain.Entities.Identity;

namespace GymManagmentApplication.Infrastructure.Repositories.Member;

public interface IMemberRepository
{
    Task<(List<User> Items, int Total)> GetAllAsync(MemberSearchRequest request);
    Task<User> CreateAsync(User user);
    Task<User?> GetByIdAsync(ulong id);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> UpdateAsync(User user);
    Task<bool> SoftDeleteAsync(ulong id);
}
