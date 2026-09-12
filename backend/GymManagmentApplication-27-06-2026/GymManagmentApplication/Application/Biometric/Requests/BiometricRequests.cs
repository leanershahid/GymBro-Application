namespace GymManagmentApplication.Application.Biometric.Requests;

public class EnrollFaceRequest
{
    public ulong UserId { get; set; }
    public string FaceImageBase64 { get; set; } = default!; // base64 encoded image
}

public class VerifyFaceRequest
{
    public string FaceImageBase64 { get; set; } = default!;
    public ulong TenantId { get; set; }
}

public class EnrollFingerprintRequest
{
    public ulong UserId { get; set; }
    public string FingerprintData { get; set; } = default!; // base64 encoded template
}

public class VerifyFingerprintRequest
{
    public string FingerprintData { get; set; } = default!;
    public ulong TenantId { get; set; }
}
