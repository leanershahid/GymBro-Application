namespace GymManagmentApplication.Application.Biometric.Responses;

public class BiometricEnrollResponse
{
    public ulong UserId { get; set; }
    public string BiometricType { get; set; } = default!;
    public bool Success { get; set; }
    public DateTime EnrolledAt { get; set; }
}

public class BiometricVerifyResponse
{
    public bool Verified { get; set; }
    public ulong? UserId { get; set; }
    public string? Name { get; set; }
    public double Confidence { get; set; }
    public DateTime VerifiedAt { get; set; }
}

public class EntryLogResponse
{
    public ulong LogId { get; set; }
    public ulong UserId { get; set; }
    public string EntryType { get; set; } = default!; // Face, Fingerprint
    public bool AccessGranted { get; set; }
    public DateTime Timestamp { get; set; }
}
