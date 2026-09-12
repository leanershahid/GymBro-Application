namespace GymManagmentApplication.Application.Member.Responses;

public class MemberResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Email { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Gender { get; set; }
    public DateOnly? Dob { get; set; }
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = default!;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    // Trainer assignment (populated when assigned on creation or via GET)
    public ulong? TrainerId { get; set; }
    public ulong? BranchId { get; set; }

    /// <summary>Only populated on the creation response so the admin can share the initial password.</summary>
    public string? DefaultPassword { get; set; }
}
