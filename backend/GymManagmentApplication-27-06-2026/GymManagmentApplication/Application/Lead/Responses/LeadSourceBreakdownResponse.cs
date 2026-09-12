namespace GymManagmentApplication.Application.Lead.Responses;

public class LeadSourceBreakdownResponse
{
    public string Source { get; set; } = default!;
    public int Count { get; set; }
    public decimal Percentage { get; set; }
}
