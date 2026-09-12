namespace GymManagmentApplication.Application.Lead.Requests;

public class CreateLeadRequest
{
    public ulong TenantId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public string? Notes { get; set; }
}
