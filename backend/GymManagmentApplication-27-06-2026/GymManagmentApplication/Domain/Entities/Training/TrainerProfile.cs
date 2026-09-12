using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Training;

public class TrainerProfile : BaseEntity
{
    public ulong? UserId { get; set; }
    public ulong? BranchId { get; set; }

    // Basic Info
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
    public JsonDocument? LanguagesKnown { get; set; }

    // Skills
    public JsonDocument? Specializations { get; set; }
    public JsonDocument? Certifications { get; set; }

    // Employment
    public JsonDocument? Employment { get; set; }

    // Salary & Compensation
    public JsonDocument? Salary { get; set; }
    public JsonDocument? Allowances { get; set; }
    public JsonDocument? Deductions { get; set; }
    public JsonDocument? PaymentDetails { get; set; }

    // Scheduling
    public JsonDocument? Availability { get; set; }
    public JsonDocument? BookingSettings { get; set; }

    // Commission
    public JsonDocument? CommissionSettings { get; set; }

    // Attendance
    public JsonDocument? AttendanceSettings { get; set; }

    // Documents & Contacts
    public JsonDocument? Documents { get; set; }
    public JsonDocument? EmergencyContact { get; set; }
    public JsonDocument? SocialLinks { get; set; }

    // Meta
    public decimal? Rating { get; set; }
    public uint TotalSessions { get; set; }
    public bool IsAvailable { get; set; } = true;
    public string? Notes { get; set; }

    public Identity.User? User { get; set; }
    public Core.Branch? Branch { get; set; }
    public ICollection<TrainerClientAssignment> ClientAssignments { get; set; } = [];
    public ICollection<TrainerAvailabilitySlot> AvailabilitySlots { get; set; } = [];
    public ICollection<TrainerTimeOff> TimeOffs { get; set; } = [];
}
