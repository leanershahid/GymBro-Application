namespace GymManagmentApplication.Application.Biometric.Requests;

public class EnrollFaceRequest
{
    public ulong UserId { get; set; }
    public string FaceImageBase64 { get; set; } = default!; // base64 encoded image
}

public class VerifyFaceRequest
{
    public string FaceImageBase64 { get; set; } = default!;
    /// <summary>Only honoured for super admins; otherwise the caller's gym.</summary>
    public ulong TenantId { get; set; }
    /// <summary>Scanner that captured the entry; the event is logged against it.</summary>
    public ulong? DeviceId { get; set; }
}

public class EnrollFingerprintRequest
{
    public ulong UserId { get; set; }
    public string FingerprintData { get; set; } = default!; // base64 encoded template
}

public class VerifyFingerprintRequest
{
    public string FingerprintData { get; set; } = default!;
    /// <summary>Only honoured for super admins; otherwise the caller's gym.</summary>
    public ulong TenantId { get; set; }
    /// <summary>Scanner that captured the entry; the event is logged against it.</summary>
    public ulong? DeviceId { get; set; }
}

/// <summary>Entry reported by a scanner that matched the member on the device.</summary>
public class DeviceEntryRequest
{
    public ulong DeviceId { get; set; }
    public ulong UserId { get; set; }
    /// <summary>"face", "fingerprint" or "card".</summary>
    public string? Method { get; set; }
}
