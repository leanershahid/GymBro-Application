namespace GymManagmentApplication.Domain.Entities.Analytics;

public class AnalyticsDaily
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong? BranchId { get; set; }
    public DateOnly ReportDate { get; set; }
    public uint TotalCheckins { get; set; }
    public uint UniqueMembers { get; set; }
    public ushort NewMembers { get; set; }
    public ushort ChurnedMembers { get; set; }
    public decimal Revenue { get; set; }
    public uint WorkoutsDone { get; set; }
    public ushort ClassesHeld { get; set; }
    public ushort? AvgSessionMin { get; set; }
    public ushort LeadsCreated { get; set; }
    public ushort LeadsConverted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Core.Tenant Tenant { get; set; } = default!;
}
