using FaceAiSharp;
using FaceAiSharp.Extensions;
using GymManagmentApplication.Application.Attendance.Face;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace GymManagmentApplication.Infrastructure.FaceMatching;

/// <summary>
/// The default, on-server face matcher (FaceAiSharp on ONNX Runtime, no external service, no keys):
/// SCRFD 2.5G finds faces and their 5 landmarks, the face is aligned and ArcFace (ResNet100, int8)
/// turns it into a 512-d embedding; two embeddings are compared by cosine similarity.
/// <para>
/// <b>Score mapping</b> (so the gym's 80–99 <c>faceMatchThreshold</c> means the same kind of thing as
/// AWS's similarity): cosine c → score, piecewise linear:
/// c ≤ 0 → 0; 0 … 0.30 → 0 … 80; 0.30 … 0.60 → 80 … 99; 0.60 … 1 → 99 … 100.
/// The default threshold 90 is c ≈ 0.46 — above FaceAiSharp's 0.42 "likely the same person" point,
/// while two selfies of the same person typically score c ≈ 0.55–0.80 (score ≈ 96–99). 80 (c = 0.30)
/// is lenient, 99 (c = 0.60) strict. See <see cref="ScoreFromCosine"/>.
/// </para>
/// <para>
/// Models load once, lazily on first use (≈ 70 MB of ONNX files, ≈ 250–350 MB of process memory once
/// loaded). Inference runs one image at a time (a semaphore): bounded CPU and memory and no reliance on
/// the library's own thread safety. Inputs are decoded at most ~1024 px on the long side. Any failure
/// throws <see cref="FaceServiceUnavailableException"/> (the caller fails closed).
/// </para>
/// <para>
/// <b>Licence:</b> the SCRFD and ArcFace weights shipped in the FaceAiSharp.Models.* packages come from
/// InsightFace and are for non-commercial research only. For commercial use, put a commercially
/// licensed ONNX detector / embedding model at <c>FaceMatching:Local:DetectorModelPath</c> /
/// <c>FaceMatching:Local:EmbedderModelPath</c> (same input/output shapes), or use Provider=aws.
/// </para>
/// </summary>
public sealed class LocalFaceMatcher : IFaceMatcher, IDisposable
{
    public const int MaxSide = 1024;
    /// <summary>Faces narrower than this share of the image width are ignored (people in the background).</summary>
    public const float MinFaceWidth = 0.10f;
    /// <summary>A reference photo needs a bigger face than that.</summary>
    public const float MinClearFaceWidth = 0.15f;
    public const float MinConfidence = 0.6f;

    public static readonly string DefaultDetectorPath = Path.Combine(AppContext.BaseDirectory, "onnx", "scrfd_2.5g_kps.onnx");
    public static readonly string DefaultEmbedderPath = Path.Combine(AppContext.BaseDirectory, "onnx", "arcfaceresnet100-11-int8.onnx");

    private readonly string _detectorPath;
    private readonly string _embedderPath;
    private readonly ILogger<LocalFaceMatcher> _logger;
    private readonly Lazy<(ScrfdDetector Detector, ArcFaceEmbeddingsGenerator Embedder)> _models;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public LocalFaceMatcher(ILogger<LocalFaceMatcher> logger, string? detectorPath = null, string? embedderPath = null)
    {
        _logger = logger;
        _detectorPath = string.IsNullOrWhiteSpace(detectorPath) ? DefaultDetectorPath : detectorPath;
        _embedderPath = string.IsNullOrWhiteSpace(embedderPath) ? DefaultEmbedderPath : embedderPath;
        _models = new Lazy<(ScrfdDetector, ArcFaceEmbeddingsGenerator)>(Load, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    /// <summary>Configured when the model files are deployed (checked without loading them).</summary>
    public bool IsConfigured => File.Exists(_detectorPath) && File.Exists(_embedderPath);
    public string ProviderName => "local";

    private (ScrfdDetector, ArcFaceEmbeddingsGenerator) Load()
    {
        var started = DateTime.UtcNow;
        var detector = new ScrfdDetector(new ScrfdDetectorOptions { ModelPath = _detectorPath, AutoResizeInputToModelDimensions = true });
        var embedder = new ArcFaceEmbeddingsGenerator(new ArcFaceEmbeddingsGeneratorOptions { ModelPath = _embedderPath, AutoResizeInputToModelDimensions = true });
        _logger.LogInformation("Local face models loaded in {Ms} ms.", (int)(DateTime.UtcNow - started).TotalMilliseconds);
        return (detector, embedder);
    }

    public Task<FaceMatchResult> CompareAsync(Stream reference, Stream probe, CancellationToken ct = default) =>
        RunAsync(async () =>
        {
            using var refImage = await DecodeAsync(reference, ct);
            using var probeImage = await DecodeAsync(probe, ct);
            if (refImage is null) return new FaceMatchResult(false, 0, null, "invalid_image");
            if (probeImage is null) return new FaceMatchResult(true, 0, null, "invalid_image");

            var (detector, embedder) = _models.Value;
            var refFaces = Faces(detector, refImage);
            if (refFaces.Count == 0) return new FaceMatchResult(false, 0, null, "reference_no_face");
            var probeFaces = Faces(detector, probeImage);
            if (probeFaces.Count != 1) return new FaceMatchResult(true, probeFaces.Count, null, probeFaces.Count == 0 ? "no_face" : "multiple_faces");

            ct.ThrowIfCancellationRequested();
            var a = Embed(embedder, refImage, refFaces.OrderByDescending(f => f.Box.Width).First());
            var b = Embed(embedder, probeImage, probeFaces[0]);
            if (a is null || b is null) return new FaceMatchResult(a is not null, b is null ? 0 : 1, null, "no_landmarks");
            return new FaceMatchResult(true, 1, ScoreFromCosine(a.CosineSimilarity(b)));
        }, ct);

    public Task<FaceDetectResult> DetectAsync(Stream image, CancellationToken ct = default) =>
        RunAsync(async () =>
        {
            using var img = await DecodeAsync(image, ct);
            if (img is null) return new FaceDetectResult(0, 0, "invalid_image");
            var faces = Faces(_models.Value.Detector, img);
            var clear = faces.Count(f => f.Landmarks is { Count: >= 5 } && f.Box.Width / img.Width >= MinClearFaceWidth);
            return new FaceDetectResult(faces.Count, clear);
        }, ct);

    /// <summary>ArcFace cosine similarity → 0–100 score (see the class remarks for the mapping).</summary>
    public static double ScoreFromCosine(double cosine)
    {
        var c = Math.Clamp(cosine, -1, 1);
        var score = c switch
        {
            <= 0 => 0,
            < 0.30 => c / 0.30 * 80,
            < 0.60 => 80 + (c - 0.30) / 0.30 * 19,
            _ => 99 + (c - 0.60) / 0.40 * 1,
        };
        return Math.Round(Math.Clamp(score, 0, 100), 2);
    }

    private async Task<T> RunAsync<T>(Func<Task<T>> work, CancellationToken ct)
    {
        if (!IsConfigured) throw new FaceServiceUnavailableException("The local face models are not deployed.");
        try
        {
            await _gate.WaitAsync(ct);
            try { return await Task.Run(work, ct); }
            finally { _gate.Release(); }
        }
        catch (FaceServiceUnavailableException) { throw; }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            // Fail closed: the caller answers "Face check unavailable". Never log the image.
            _logger.LogWarning("Local face matching failed: {Type}", ex.GetType().Name);
            throw new FaceServiceUnavailableException("Local face matching failed.", ex);
        }
    }

    /// <summary>Decodes at most ~<see cref="MaxSide"/> px on the long side, EXIF-rotated; null for an unreadable image.</summary>
    private static async Task<Image<Rgb24>?> DecodeAsync(Stream s, CancellationToken ct)
    {
        try
        {
            var options = new DecoderOptions { TargetSize = new Size(MaxSide, MaxSide) };
            var img = await Image.LoadAsync<Rgb24>(options, s, ct);
            img.Mutate(x =>
            {
                x.AutoOrient();
                if (img.Width > MaxSide || img.Height > MaxSide)
                    x.Resize(new ResizeOptions { Mode = ResizeMode.Max, Size = new Size(MaxSide, MaxSide) });
            });
            return img;
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
        {
            return null;
        }
    }

    private static List<FaceDetectorResult> Faces(ScrfdDetector detector, Image<Rgb24> img) =>
        detector.DetectFaces(img)
            .Where(f => (f.Confidence ?? 0f) >= MinConfidence && f.Box.Width / img.Width >= MinFaceWidth)
            .ToList();

    private static float[]? Embed(ArcFaceEmbeddingsGenerator embedder, Image<Rgb24> img, FaceDetectorResult face)
    {
        if (face.Landmarks is not { Count: >= 5 } landmarks) return null;
        using var aligned = img.Clone();
        ArcFaceEmbeddingsGenerator.AlignFaceUsingLandmarks(aligned, landmarks);
        return embedder.GenerateEmbedding(aligned);
    }

    public void Dispose()
    {
        if (_models.IsValueCreated)
        {
            (_models.Value.Detector as IDisposable)?.Dispose();
            (_models.Value.Embedder as IDisposable)?.Dispose();
        }
        _gate.Dispose();
    }
}
