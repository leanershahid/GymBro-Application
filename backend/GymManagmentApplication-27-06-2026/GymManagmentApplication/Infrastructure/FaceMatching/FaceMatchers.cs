using Amazon;
using Amazon.Rekognition;
using Amazon.Rekognition.Model;
using Amazon.Runtime;
using GymManagmentApplication.Application.Attendance.Face;

namespace GymManagmentApplication.Infrastructure.FaceMatching;

/// <summary>
/// "FaceMatching" section. <c>Provider</c> (env FaceMatching__Provider):
/// <list type="bullet">
/// <item><c>local</c> (default, also when empty): <see cref="LocalFaceMatcher"/> — FaceAiSharp / ONNX on this
/// server, no keys, no per-check cost.</item>
/// <item><c>aws</c>: AWS Rekognition, when the "Aws" section has a region and keys (Aws__Region,
/// Aws__AccessKeyId, Aws__SecretAccessKey); without them face matching is not configured.</item>
/// <item><c>disabled</c>: <see cref="DisabledFaceMatcher"/>: face check-in can't be switched on.</item>
/// </list>
/// </summary>
public class FaceMatchingSettings
{
    public string? Provider { get; set; }
}

/// <summary>"Aws" section. Keys come from the environment / Render dashboard, never from committed files.</summary>
public class AwsSettings
{
    public string? Region { get; set; }
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }

    public bool HasCredentials =>
        !string.IsNullOrWhiteSpace(Region) && !string.IsNullOrWhiteSpace(AccessKeyId) && !string.IsNullOrWhiteSpace(SecretAccessKey);
}

public static class FaceMatchingRegistration
{
    public static IServiceCollection AddFaceMatching(this IServiceCollection services, IConfiguration config)
    {
        var provider = config["FaceMatching:Provider"]?.Trim().ToLowerInvariant();
        switch (string.IsNullOrEmpty(provider) ? "local" : provider)
        {
            case "local":
                // One instance for the app: the models load once, on the first face check.
                services.AddSingleton<IFaceMatcher>(sp => new LocalFaceMatcher(
                    sp.GetRequiredService<ILogger<LocalFaceMatcher>>(),
                    config["FaceMatching:Local:DetectorModelPath"], config["FaceMatching:Local:EmbedderModelPath"]));
                break;
            case "aws":
                var aws = config.GetSection("Aws").Get<AwsSettings>() ?? new AwsSettings();
                if (aws.HasCredentials)
                    services.AddSingleton<IFaceMatcher>(sp => new AwsRekognitionFaceMatcher(aws, sp.GetRequiredService<ILogger<AwsRekognitionFaceMatcher>>()));
                else
                    services.AddSingleton<IFaceMatcher, DisabledFaceMatcher>();
                break;
            default: // "disabled" or anything unknown
                services.AddSingleton<IFaceMatcher, DisabledFaceMatcher>();
                break;
        }
        return services;
    }
}

/// <summary>No face service configured: <see cref="IsConfigured"/> is false and every call fails closed.</summary>
public sealed class DisabledFaceMatcher : IFaceMatcher
{
    public bool IsConfigured => false;
    public string ProviderName => "none";

    public Task<FaceMatchResult> CompareAsync(Stream reference, Stream probe, CancellationToken ct = default) =>
        throw new FaceServiceUnavailableException("No face matching service is configured.");

    public Task<FaceDetectResult> DetectAsync(Stream image, CancellationToken ct = default) =>
        throw new FaceServiceUnavailableException("No face matching service is configured.");
}

/// <summary>
/// AWS Rekognition: CompareFaces for check-in, DetectFaces for the reference photo. Images are sent as
/// bytes (≤ 5 MB, checked before), nothing is stored at AWS (no collections). Never logs image bytes,
/// keys or similarity of a specific person beyond the attempt row.
/// <para>Cost (2026 list price, us-east-1 / ap-south-1 similar): about USD 0.001 per image API call for the
/// first million a month: one CompareFaces per check-in attempt, one DetectFaces per enrolment.</para>
/// </summary>
public sealed class AwsRekognitionFaceMatcher : IFaceMatcher, IDisposable
{
    /// <summary>Faces smaller than this share of the image width are ignored (people in the background).</summary>
    public const float MinFaceWidth = 0.10f;
    private const float MinConfidence = 90f;

    private readonly AmazonRekognitionClient _client;
    private readonly ILogger<AwsRekognitionFaceMatcher> _logger;

    public AwsRekognitionFaceMatcher(AwsSettings settings, ILogger<AwsRekognitionFaceMatcher> logger)
    {
        _logger = logger;
        _client = new AmazonRekognitionClient(
            new BasicAWSCredentials(settings.AccessKeyId, settings.SecretAccessKey),
            new AmazonRekognitionConfig
            {
                RegionEndpoint = RegionEndpoint.GetBySystemName(settings.Region!.Trim()),
                Timeout = TimeSpan.FromSeconds(10),
                MaxErrorRetry = 1,
            });
    }

    public bool IsConfigured => true;
    public string ProviderName => "aws";

    public async Task<FaceMatchResult> CompareAsync(Stream reference, Stream probe, CancellationToken ct = default)
    {
        try
        {
            var res = await _client.CompareFacesAsync(new CompareFacesRequest
            {
                SourceImage = new Image { Bytes = await ToMemoryAsync(reference, ct) },
                TargetImage = new Image { Bytes = await ToMemoryAsync(probe, ct) },
                // 0 = every face in the selfie comes back with its similarity; the gym's threshold is applied by the caller.
                SimilarityThreshold = 0,
                QualityFilter = QualityFilter.NONE,
            }, ct);

            var matches = (res.FaceMatches ?? []).Where(m => IsRealFace(m.Face?.BoundingBox, m.Face?.Confidence)).ToList();
            var unmatched = (res.UnmatchedFaces ?? []).Where(f => IsRealFace(f.BoundingBox, f.Confidence)).ToList();
            var faceCount = matches.Count + unmatched.Count;
            double? best = matches.Count > 0 ? matches.Max(m => (double)(m.Similarity ?? 0f)) : faceCount == 1 ? 0d : null;
            return new FaceMatchResult(res.SourceImageFace is not null, faceCount, faceCount == 1 ? best : null);
        }
        catch (InvalidParameterException)
        {
            // Rekognition's answer when it finds no face in one of the images (the reference was checked at enrolment).
            return new FaceMatchResult(true, 0, null, "no_face");
        }
        catch (Exception ex) when (ex is InvalidImageFormatException or ImageTooLargeException)
        {
            return new FaceMatchResult(true, 0, null, "invalid_image");
        }
        catch (Exception ex) when (ex is AmazonServiceException or AmazonClientException or HttpRequestException or TaskCanceledException or IOException)
        {
            _logger.LogWarning("Rekognition CompareFaces failed: {Type} {Code}", ex.GetType().Name, (ex as AmazonServiceException)?.ErrorCode);
            throw new FaceServiceUnavailableException("The face service didn't answer.", ex);
        }
    }

    public async Task<FaceDetectResult> DetectAsync(Stream image, CancellationToken ct = default)
    {
        try
        {
            var res = await _client.DetectFacesAsync(new DetectFacesRequest
            {
                Image = new Image { Bytes = await ToMemoryAsync(image, ct) },
                Attributes = ["DEFAULT"],
            }, ct);
            var faces = (res.FaceDetails ?? []).Where(f => IsRealFace(f.BoundingBox, f.Confidence)).ToList();
            var clear = faces.Count(f =>
                Math.Abs(f.Pose?.Yaw ?? 90f) <= 30 && Math.Abs(f.Pose?.Pitch ?? 90f) <= 30
                && (f.Quality?.Sharpness ?? 0f) >= 10 && (f.Quality?.Brightness ?? 0f) >= 20
                && (f.BoundingBox?.Width ?? 0f) >= 0.15f);
            return new FaceDetectResult(faces.Count, clear);
        }
        catch (Exception ex) when (ex is InvalidParameterException or InvalidImageFormatException or ImageTooLargeException)
        {
            return new FaceDetectResult(0, 0, "invalid_image");
        }
        catch (Exception ex) when (ex is AmazonServiceException or AmazonClientException or HttpRequestException or TaskCanceledException or IOException)
        {
            _logger.LogWarning("Rekognition DetectFaces failed: {Type} {Code}", ex.GetType().Name, (ex as AmazonServiceException)?.ErrorCode);
            throw new FaceServiceUnavailableException("The face service didn't answer.", ex);
        }
    }

    private static bool IsRealFace(BoundingBox? box, float? confidence) =>
        (confidence ?? 0f) >= MinConfidence && (box?.Width ?? 0f) >= MinFaceWidth;

    private static async Task<MemoryStream> ToMemoryAsync(Stream s, CancellationToken ct)
    {
        var ms = new MemoryStream();
        await s.CopyToAsync(ms, ct);
        ms.Position = 0;
        return ms;
    }

    public void Dispose() => _client.Dispose();
}
