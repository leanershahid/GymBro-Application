using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Application.Branch.Requests;

public class CreateBranchRequest
{
    public ulong TenantId { get; set; }
    public ulong? ParentId { get; set; }
    public required string Name { get; set; }
    public required string Code { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Zip { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Timezone { get; set; } = "UTC";
    public ushort? Capacity { get; set; }
    public string? LogoUrl { get; set; }
}

public class UpdateBranchRequest
{
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Zip { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Timezone { get; set; }
    public ushort? Capacity { get; set; }
    public string? LogoUrl { get; set; }
    public BranchStatus? Status { get; set; }
}
