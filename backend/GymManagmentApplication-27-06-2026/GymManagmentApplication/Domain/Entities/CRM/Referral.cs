using GymManagmentApplication.Domain.Enums;

namespace GymManagmentApplication.Domain.Entities.CRM;

public class Referral
{
    public ulong Id { get; set; }
    public ulong ProgramId { get; set; }
    public ulong ReferrerId { get; set; }
    public ulong? RefereeId { get; set; }
    public string? RefereeEmail { get; set; }
    public string Code { get; set; } = default!;
    public ReferralStatus Status { get; set; } = ReferralStatus.Pending;
    public DateTime? ConvertedAt { get; set; }
    public DateTime? RewardedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ReferralProgram Program { get; set; } = default!;
    public Identity.User Referrer { get; set; } = default!;
    public Identity.User? Referee { get; set; }
}
