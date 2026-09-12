namespace GymManagmentApplication.Application.Trainer.Responses;

public class TrainerResponse
{
    public ulong Id { get; set; }
    public ulong? UserId { get; set; }
    public ulong? BranchId { get; set; }

    public string? TrainerCode { get; set; }
    public string? DisplayName { get; set; }
    public string? ProfileImage { get; set; }
    public string? Bio { get; set; }
    public byte? ExperienceYears { get; set; }
    public string? Gender { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public List<string>? LanguagesKnown { get; set; }

    public List<string>? Specializations { get; set; }
    public object? Certifications { get; set; }

    public object? Employment { get; set; }
    public object? Salary { get; set; }
    public object? Allowances { get; set; }
    public object? Deductions { get; set; }
    public object? PaymentDetails { get; set; }

    public object? Availability { get; set; }
    public object? BookingSettings { get; set; }
    public object? CommissionSettings { get; set; }
    public object? AttendanceSettings { get; set; }

    public object? Documents { get; set; }
    public object? EmergencyContact { get; set; }
    public object? SocialLinks { get; set; }

    public decimal? Rating { get; set; }
    public bool IsAvailable { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}
