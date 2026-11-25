using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Application.Attendance.Face;

/// <summary>Result of comparing a check-in selfie (probe) with the member's reference photo.</summary>
/// <param name="ReferenceFaceFound">A face was found in the reference photo.</param>
/// <param name="ProbeFaceCount">Faces found in the selfie (0 = none, more than 1 = not usable).</param>
/// <param name="Similarity">0–100 similarity of the best match; null when nothing could be compared.</param>
/// <param name="Detail">Short reason when the images could not be compared (no_face, invalid_image…).</param>
public sealed record FaceMatchResult(bool ReferenceFaceFound, int ProbeFaceCount, double? Similarity, string? Detail = null)
{
    /// <summary>Exactly one face in the selfie and one in the reference: the similarity means something.</summary>
    public bool Comparable => ReferenceFaceFound && ProbeFaceCount == 1 && Similarity.HasValue;
}

/// <summary>Faces found in one image (enrolment check).</summary>
/// <param name="FaceCount">All faces found.</param>
/// <param name="ClearFaceCount">Faces that are large, sharp and frontal enough to match reliably.</param>
public sealed record FaceDetectResult(int FaceCount, int ClearFaceCount, string? Detail = null);

/// <summary>
/// Server-side face matching (Application abstraction; the AWS Rekognition implementation and the
/// "not configured" fallback live in Infrastructure/FaceMatching). Implementations never log image
/// bytes or credentials, and throw <see cref="FaceServiceUnavailableException"/> for any service
/// failure or timeout so callers can fail closed.
/// </summary>
public interface IFaceMatcher
{
    /// <summary>True when a face service is configured (provider + credentials / models).</summary>
    bool IsConfigured { get; }

    /// <summary>"local" (on this server), "aws" (AWS Rekognition) or "none"; shown in settings and the consent text.</summary>
    string ProviderName => "custom";

    /// <summary>Compares the largest face of <paramref name="reference"/> with the faces in <paramref name="probe"/>.</summary>
    Task<FaceMatchResult> CompareAsync(Stream reference, Stream probe, CancellationToken ct = default);

    /// <summary>Counts the faces in an image (used to accept a reference photo with exactly one clear face).</summary>
    Task<FaceDetectResult> DetectAsync(Stream image, CancellationToken ct = default);
}

/// <summary>The face service could not answer (not configured, error, timeout). Never means "no match".</summary>
public class FaceServiceUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>Machine-readable codes of the face check (the envelope's <c>code</c>).</summary>
public static class FaceCheckCodes
{
    /// <summary>422: face check is on and the member has no reference photo (the app opens enrolment).</summary>
    public const string EnrollRequired = "FACE_ENROLL_REQUIRED";
    /// <summary>422: the selfie doesn't match the reference photo.</summary>
    public const string Mismatch = "FACE_MISMATCH";
    /// <summary>422: no face or several faces in the selfie; retry.</summary>
    public const string NotClear = "FACE_NOT_CLEAR";
    /// <summary>422: too many mismatches; check in at the front desk.</summary>
    public const string Locked = "FACE_LOCKED";
    /// <summary>503: the face service failed or timed out; nobody is checked in.</summary>
    public const string Unavailable = "FACE_UNAVAILABLE";
    /// <summary>422: the member hasn't given (or withdrew) consent to face check-in.</summary>
    public const string ConsentRequired = "FACE_CONSENT_REQUIRED";
}

/// <summary>
/// Upload rules for face photos: at most 5 MB, JPEG or PNG only, recognised by the file's first
/// bytes (the client's Content-Type and file name are ignored). The same limits as AWS Rekognition's
/// image bytes. Storage repeats the check (<see cref="FileKind.FaceImage"/>).
/// </summary>
public static class FaceImages
{
    public const long MaxBytes = 5 * 1024 * 1024;

    public static async Task<byte[]> ReadAsync(FileUpload? file)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("Take a selfie first.");
        if (file.Length > MaxBytes) throw new ArgumentException("The photo is too large (max 5 MB).");
        using var ms = new MemoryStream();
        await using (var s = file.OpenReadStream())
        {
            var buffer = new byte[81920];
            int read;
            while ((read = await s.ReadAsync(buffer)) > 0)
            {
                ms.Write(buffer, 0, read);
                if (ms.Length > MaxBytes) throw new ArgumentException("The photo is too large (max 5 MB).");
            }
        }
        var bytes = ms.ToArray();
        if (!IsJpegOrPng(bytes)) throw new ArgumentException("This file type isn't allowed. Use JPG or PNG.");
        return bytes;
    }

    public static bool IsJpegOrPng(ReadOnlySpan<byte> b) =>
        (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF)
        || (b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }));

    public static string ContentTypeOf(ReadOnlySpan<byte> b) => b.Length >= 1 && b[0] == 0x89 ? "image/png" : "image/jpeg";
}
