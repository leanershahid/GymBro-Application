using GymManagmentApplication.Application.Attendance.Face;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Infrastructure.FaceMatching;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit.Abstractions;

namespace GymManagmentApplication.Tests;

/// <summary>
/// The default on-server matcher (FaceAiSharp / ONNX Runtime) on tiny synthetic images. The real
/// models are loaded, so these need the ONNX files and native onnxruntime in the test output; when
/// they can't load in an environment, the model-dependent tests return early with the reason written
/// to the test output (xUnit 2 has no runtime skip).
/// </summary>
public class LocalFaceMatcherTests(ITestOutputHelper output)
{
    private static byte[] Png(int w, int h, Func<int, int, Rgb24> pixel)
    {
        using var img = new Image<Rgb24>(w, h);
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) img[x, y] = pixel(x, y);
        using var ms = new MemoryStream();
        img.SaveAsPng(ms);
        return ms.ToArray();
    }

    private static readonly byte[] Gray = Png(64, 64, (_, _) => new Rgb24(128, 128, 128));
    private static readonly byte[] Noise = Png(96, 96, (x, y) => new Rgb24((byte)(x * 37 ^ y * 11), (byte)(y * 53), (byte)(x * y)));

    /// <summary>Runs <paramref name="test"/> unless the models can't be loaded here (then reports why and passes).</summary>
    private async Task WithModelsAsync(Func<LocalFaceMatcher, Task> test)
    {
        using var matcher = new LocalFaceMatcher(NullLogger<LocalFaceMatcher>.Instance);
        if (!matcher.IsConfigured)
        {
            output.WriteLine($"SKIPPED: face models not found at {LocalFaceMatcher.DefaultDetectorPath}.");
            return;
        }
        try { await matcher.DetectAsync(new MemoryStream(Gray)); }
        catch (FaceServiceUnavailableException ex) when (ex.InnerException is DllNotFoundException or TypeInitializationException or BadImageFormatException)
        {
            output.WriteLine($"SKIPPED: ONNX Runtime can't load in this environment ({ex.InnerException.GetType().Name}).");
            return;
        }
        output.WriteLine($"Process working set with the models loaded: {Environment.WorkingSet / (1024 * 1024)} MB.");
        await test(matcher);
    }

    [Fact]
    public Task Images_without_a_face_are_reported_as_no_face_without_crashing() => WithModelsAsync(async matcher =>
    {
        var detect = await matcher.DetectAsync(new MemoryStream(Noise));
        Assert.Equal(0, detect.FaceCount);
        Assert.Equal(0, detect.ClearFaceCount);

        var compare = await matcher.CompareAsync(new MemoryStream(Gray), new MemoryStream(Noise));
        Assert.False(compare.Comparable);
        Assert.Null(compare.Similarity);
    });

    [Fact]
    public Task An_unreadable_image_is_not_a_crash() => WithModelsAsync(async matcher =>
    {
        var garbage = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5 }; // JPEG magic, broken body
        var detect = await matcher.DetectAsync(new MemoryStream(garbage));
        Assert.Equal(0, detect.FaceCount);
        Assert.Equal("invalid_image", detect.Detail);
    });

    [Fact]
    public Task Enrolling_a_photo_without_a_face_is_FACE_NOT_CLEAR() => WithModelsAsync(async matcher =>
    {
        using var db = new TestDb();
        db.SeedGym(1);
        db.AddMember(100);
        var me = new FakeUser { UserId = 100, Role = "client", TenantId = 1 };
        using var ctx = db.Create(me);
        var face = new FaceCheckInService(ctx, me, matcher, new PrivateStorage(), NullLogger<FaceCheckInService>.Instance);
        var ex = await Assert.ThrowsAsync<RuleException>(() =>
            face.EnrollMineAsync(FileUpload.FromBytes("x.png", "image/png", Noise), consent: true, DateTime.UtcNow, null));
        Assert.Equal(FaceCheckCodes.NotClear, ex.Code);
    });

    [Theory]
    [InlineData(-0.5, 0)]
    [InlineData(0.0, 0)]
    [InlineData(0.15, 40)]
    [InlineData(0.30, 80)]
    [InlineData(0.45, 89.5)]
    [InlineData(0.60, 99)]
    [InlineData(1.0, 100)]
    public void Cosine_similarity_maps_onto_the_threshold_scale(double cosine, double score) =>
        Assert.Equal(score, LocalFaceMatcher.ScoreFromCosine(cosine), 2);

    [Fact]
    public void The_score_never_decreases_as_similarity_grows()
    {
        var last = -1.0;
        for (var c = -1.0; c <= 1.0; c += 0.01)
        {
            var s = LocalFaceMatcher.ScoreFromCosine(c);
            Assert.True(s >= last);
            last = s;
        }
    }

    [Theory]
    [InlineData(null, typeof(LocalFaceMatcher))]
    [InlineData("", typeof(LocalFaceMatcher))]
    [InlineData("local", typeof(LocalFaceMatcher))]
    [InlineData("disabled", typeof(DisabledFaceMatcher))]
    [InlineData("aws", typeof(DisabledFaceMatcher))] // aws without keys
    public void Provider_selects_the_matcher(string? provider, Type expected)
    {
        var services = new ServiceCollection().AddLogging();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["FaceMatching:Provider"] = provider }).Build();
        services.AddFaceMatching(config);
        using var sp = services.BuildServiceProvider();
        Assert.IsType(expected, sp.GetRequiredService<IFaceMatcher>());
    }

    private sealed class PrivateStorage : IFileStorage
    {
        public bool SupportsPrivateFiles => true;
        public Task<string> SaveAsync(FileUpload file, string folder, FileKind kind) => Task.FromResult($"https://private.test/{Guid.NewGuid():N}");
        public Task DeleteAsync(string? url) => Task.CompletedTask;
        public Task<string> GetSignedUrlAsync(string url) => Task.FromResult(url);
    }
}
