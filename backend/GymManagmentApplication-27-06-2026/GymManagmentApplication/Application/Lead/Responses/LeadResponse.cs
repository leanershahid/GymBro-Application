namespace GymManagmentApplication.Application.Lead.Responses;

public class LeadResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }

    /// <summary>Set after conversion: the member account created from this lead.</summary>
    public ulong? MemberId { get; set; }
    /// <summary>Set after conversion: one-time password for the new member.</summary>
    public string? TemporaryPassword { get; set; }
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
