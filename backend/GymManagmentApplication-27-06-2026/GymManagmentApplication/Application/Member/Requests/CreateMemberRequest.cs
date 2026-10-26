namespace GymManagmentApplication.Application.Member.Requests;

public class CreateMemberRequest
{
    /// <summary>Only honoured for super admins; everyone else creates in their own gym.</summary>
    public ulong TenantId { get; set; }
    public string Email { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Gender { get; set; }
    public DateOnly? Dob { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Notes { get; set; }

    /// <summary>Member's home branch. Defaults to the trainer's branch when a trainer is given.</summary>
    public ulong? BranchId { get; set; }

    // Optional trainer assignment on creation
    public ulong? TrainerId { get; set; }
}
