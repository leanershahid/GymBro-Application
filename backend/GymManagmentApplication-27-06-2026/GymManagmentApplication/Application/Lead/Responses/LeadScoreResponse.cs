namespace GymManagmentApplication.Application.Lead.Responses;

public class LeadScoreResponse
{
    public ulong LeadId { get; set; }
    public byte Score { get; set; }
    public decimal ConversionProbability { get; set; }
    public string Recommendation { get; set; } = default!;
}
