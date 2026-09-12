namespace GymManagmentApplication.Application.Lead.Responses;

public class LeadResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public string Status { get; set; } = default!;
    public byte? AiScore { get; set; }
    public decimal? ConversionProb { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}
