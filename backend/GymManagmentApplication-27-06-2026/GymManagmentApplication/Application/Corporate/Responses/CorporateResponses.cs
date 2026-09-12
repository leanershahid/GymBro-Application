namespace GymManagmentApplication.Application.Corporate.Responses;

public class CorporateAccountResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public uint? MaxMembers { get; set; }
    public string Status { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class CorporateMemberResponse
{
    public ulong MembershipId { get; set; }
    public ulong UserId { get; set; }
    public string Status { get; set; } = default!;
    public DateOnly StartsAt { get; set; }
    public DateOnly? EndsAt { get; set; }
}

public class CorporateBillingResponse
{
    public ulong CorporateId { get; set; }
    public int TotalMembers { get; set; }
    public decimal TotalBilled { get; set; }
    public string Currency { get; set; } = "USD";
}
