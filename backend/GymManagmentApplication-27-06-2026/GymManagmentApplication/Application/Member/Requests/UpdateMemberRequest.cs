namespace GymManagmentApplication.Application.Member.Requests;

public class UpdateMemberRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Gender { get; set; }
    public DateOnly? Dob { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Notes { get; set; }

    /// <summary>Move the member to another branch of the same gym (admin only).</summary>
    public ulong? BranchId { get; set; }
}
