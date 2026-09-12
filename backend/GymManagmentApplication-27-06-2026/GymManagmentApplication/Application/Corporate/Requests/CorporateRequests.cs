namespace GymManagmentApplication.Application.Corporate.Requests;

public class CreateCorporateAccountRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public uint? MaxMembers { get; set; }
}

public class UpdateCorporateAccountRequest
{
    public string? Name { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public uint? MaxMembers { get; set; }
    public string? Status { get; set; }
}

public class AddCorporateMemberRequest
{
    public ulong UserId { get; set; }
    public ulong PlanId { get; set; }
    public DateOnly StartsAt { get; set; }
}

public class CorporateAccountListRequest
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
