namespace GymManagmentApplication.Application.Trainer.Requests;

public class CreateTrainerRequest
{
    public ulong BranchId { get; set; }

    // Basic Info
    public required string TrainerCode { get; set; }
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

    // Skills
    public List<string>? Specializations { get; set; }
    public List<CertificationRequest>? Certifications { get; set; }

    // Employment & Compensation
    public EmploymentRequest? Employment { get; set; }
    public SalaryRequest? Salary { get; set; }
    public List<AllowanceRequest>? Allowances { get; set; }
    public List<DeductionRequest>? Deductions { get; set; }
    public PaymentDetailsRequest? PaymentDetails { get; set; }

    // Scheduling
    public List<AvailabilityRequest>? Availability { get; set; }
    public BookingSettingsRequest? BookingSettings { get; set; }

    // Commission & Attendance
    public CommissionSettingsRequest? CommissionSettings { get; set; }
    public AttendanceSettingsRequest? AttendanceSettings { get; set; }

    // Misc
    public List<DocumentRequest>? Documents { get; set; }
    public EmergencyContactRequest? EmergencyContact { get; set; }
    public SocialLinksRequest? SocialLinks { get; set; }
    public string? Notes { get; set; }
}

public class CertificationRequest
{
    public string? CertificateName { get; set; }
    public string? CertificateNumber { get; set; }
    public string? IssuedBy { get; set; }
    public DateOnly? IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? DocumentUrl { get; set; }
}

public class EmploymentRequest
{
    public string? EmploymentType { get; set; }
    public DateOnly? JoiningDate { get; set; }
    public DateOnly? ContractStartDate { get; set; }
    public DateOnly? ContractEndDate { get; set; }
    public string? Designation { get; set; }
    public string? Department { get; set; }
    public string? Status { get; set; }
}

public class SalaryRequest
{
    public string? SalaryType { get; set; }
    public string? PaymentCycle { get; set; }
    public string? Currency { get; set; }
    public decimal? BasicSalary { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? PerSessionRate { get; set; }
    public decimal? PerClientRate { get; set; }
    public decimal? PerClassRate { get; set; }
    public string? CommissionType { get; set; }
    public decimal? CommissionValue { get; set; }
    public string? CommissionBasedOn { get; set; }
    public decimal? MinimumGuaranteedAmount { get; set; }
    public bool OvertimeApplicable { get; set; }
    public decimal? OvertimeHourlyRate { get; set; }
}

public class AllowanceRequest
{
    public string? AllowanceType { get; set; }
    public decimal Amount { get; set; }
    public bool IsTaxable { get; set; }
}

public class DeductionRequest
{
    public string? DeductionType { get; set; }
    public decimal Amount { get; set; }
    public bool IsPercentage { get; set; }
}

public class PaymentDetailsRequest
{
    public string? PaymentMode { get; set; }
    public string? BankName { get; set; }
    public string? AccountHolderName { get; set; }
    public string? AccountNumber { get; set; }
    public string? IfscCode { get; set; }
    public string? UpiId { get; set; }
    public string? TaxNumber { get; set; }
}

public class AvailabilityRequest
{
    public string? Day { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public bool IsAvailable { get; set; }
}

public class BookingSettingsRequest
{
    public bool CanTakePersonalTraining { get; set; }
    public bool CanTakeGroupClasses { get; set; }
    public bool CanTakeOnlineSessions { get; set; }
    public bool CanTakeTrialSessions { get; set; }
    public ushort? MaxClients { get; set; }
    public byte? MaxDailySessions { get; set; }
    public byte? MaxWeeklySessions { get; set; }
    public ushort? SessionDurationMinutes { get; set; }
    public byte? BufferTimeMinutes { get; set; }
    public bool RequiresApprovalForBooking { get; set; }
}

public class CommissionSettingsRequest
{
    public bool EligibleForMembershipCommission { get; set; }
    public bool EligibleForPersonalTrainingCommission { get; set; }
    public bool EligibleForSupplementCommission { get; set; }
    public decimal? MembershipCommissionPercentage { get; set; }
    public decimal? PtCommissionPercentage { get; set; }
    public decimal? SupplementCommissionPercentage { get; set; }
}

public class AttendanceSettingsRequest
{
    public bool AttendanceRequired { get; set; }
    public byte? LateMarkAfterMinutes { get; set; }
    public ushort? HalfDayAfterMinutes { get; set; }
    public byte? MinimumWorkingHours { get; set; }
    public List<string>? WeeklyOffDays { get; set; }
}

public class DocumentRequest
{
    public string? DocumentType { get; set; }
    public string? DocumentNumber { get; set; }
    public string? DocumentUrl { get; set; }
    public DateOnly? ExpiryDate { get; set; }
}

public class EmergencyContactRequest
{
    public string? Name { get; set; }
    public string? Relation { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
}

public class SocialLinksRequest
{
    public string? Instagram { get; set; }
    public string? Facebook { get; set; }
    public string? Youtube { get; set; }
    public string? Website { get; set; }
}
