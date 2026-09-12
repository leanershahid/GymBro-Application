namespace GymManagmentApplication.Application.Lead.Requests;

public class LeadListRequest
{
    public ulong? TenantId { get; set; }
    public string? Status { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
