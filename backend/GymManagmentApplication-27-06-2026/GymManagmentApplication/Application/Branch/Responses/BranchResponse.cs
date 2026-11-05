namespace GymManagmentApplication.Application.Branch.Responses;

public class BranchResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? ParentId { get; set; }
    public string Name { get; set; } = default!;
    public string Code { get; set; } = default!;
    public string Status { get; set; } = default!;
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? Zip { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string Timezone { get; set; } = default!;
    public ushort? Capacity { get; set; }
    public string? LogoUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}
