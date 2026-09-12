using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Corporate.Interfaces;
using GymManagmentApplication.Application.Corporate.Requests;
using GymManagmentApplication.Application.Corporate.Responses;
using GymManagmentApplication.Domain.Entities.Membership;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories.Corporate;

namespace GymManagmentApplication.Application.Corporate.Services;

public class CorporateService(ICorporateRepository repository) : ICorporateService
{
    public async Task<PagedResponse<CorporateAccountResponse>> GetAllAsync(CorporateAccountListRequest request)
    {
        var (items, total) = await repository.GetAllAsync(request.PageNumber, request.PageSize);
        return new PagedResponse<CorporateAccountResponse>
        {
            Items = items.Select(Map),
            PageNumber = request.PageNumber,
            PageSize = request.PageSize,
            TotalRecords = total
        };
    }

    public async Task<CorporateAccountResponse> CreateAsync(CreateCorporateAccountRequest request)
    {
        var account = new CorporateAccount
        {
            TenantId = request.TenantId,
            Name = request.Name,
            ContactEmail = request.ContactEmail,
            ContactPhone = request.ContactPhone,
            MaxMembers = request.MaxMembers,
            Status = CorporateStatus.Active
        };
        return Map(await repository.CreateAsync(account));
    }

    public async Task<CorporateAccountResponse?> GetByIdAsync(ulong id)
    {
        var account = await repository.GetByIdAsync(id);
        return account is null ? null : Map(account);
    }

    public async Task<CorporateAccountResponse?> UpdateAsync(ulong id, UpdateCorporateAccountRequest request)
    {
        var account = await repository.GetByIdAsync(id);
        if (account is null) return null;
        if (request.Name is not null) account.Name = request.Name;
        if (request.ContactEmail is not null) account.ContactEmail = request.ContactEmail;
        if (request.ContactPhone is not null) account.ContactPhone = request.ContactPhone;
        if (request.MaxMembers.HasValue) account.MaxMembers = request.MaxMembers;
        if (request.Status is not null && Enum.TryParse<CorporateStatus>(request.Status, true, out var s)) account.Status = s;
        await repository.UpdateAsync(account);
        return Map(account);
    }

    public async Task<List<CorporateMemberResponse>> GetMembersAsync(ulong id)
    {
        var memberships = await repository.GetMembershipsAsync(id);
        return memberships.Select(m => new CorporateMemberResponse
        {
            MembershipId = m.Id,
            UserId = m.UserId,
            Status = m.Status.ToString(),
            StartsAt = m.StartsAt,
            EndsAt = m.EndsAt
        }).ToList();
    }

    public async Task<CorporateMemberResponse> AddMemberAsync(ulong id, AddCorporateMemberRequest request)
    {
        var account = await repository.GetByIdAsync(id);
        var membership = new GymMembership
        {
            CorporateId = id,
            UserId = request.UserId,
            PlanId = request.PlanId,
            TenantId = account?.TenantId ?? 0,
            StartsAt = request.StartsAt,
            Status = MembershipStatus.Active,
            Source = MembershipSource.Admin
        };
        var created = await repository.AddMembershipAsync(membership);
        return new CorporateMemberResponse { MembershipId = created.Id, UserId = created.UserId, Status = created.Status.ToString(), StartsAt = created.StartsAt, EndsAt = created.EndsAt };
    }

    public Task<bool> RemoveMemberAsync(ulong accountId, ulong userId) =>
        repository.RemoveMembershipAsync(accountId, userId);

    public async Task<CorporateBillingResponse?> GetBillingAsync(ulong id)
    {
        var account = await repository.GetByIdAsync(id);
        if (account is null) return null;
        var memberships = await repository.GetMembershipsAsync(id);
        return new CorporateBillingResponse { CorporateId = id, TotalMembers = memberships.Count, TotalBilled = 0 };
    }

    private static CorporateAccountResponse Map(CorporateAccount a) => new()
    {
        Id = a.Id, TenantId = a.TenantId, Name = a.Name, ContactEmail = a.ContactEmail,
        ContactPhone = a.ContactPhone, MaxMembers = a.MaxMembers, Status = a.Status.ToString(), CreatedAt = a.CreatedAt
    };
}
