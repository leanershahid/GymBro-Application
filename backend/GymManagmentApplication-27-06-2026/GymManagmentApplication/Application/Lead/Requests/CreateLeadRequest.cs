namespace GymManagmentApplication.Application.Lead.Requests;

public class CreateLeadRequest
{
    /// <summary>Only honoured for super admins; everyone else creates in their own gym.</summary>
    public ulong TenantId { get; set; }
    /// <summary>Branch the enquiry came in at (optional).</summary>
    public ulong? BranchId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
}
