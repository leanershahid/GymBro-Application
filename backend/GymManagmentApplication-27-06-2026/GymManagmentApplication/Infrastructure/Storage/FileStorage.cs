using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace GymManagmentApplication.Infrastructure.Storage;

/// <summary>
/// "Storage" section. With SupabaseUrl + ServiceKey set (Storage__SupabaseUrl, Storage__ServiceKey)
/// files go to a public Supabase Storage bucket; otherwise they're written under wwwroot/uploads
/// (fine locally — Render's disk is wiped on every deploy, so production needs Supabase).
/// </summary>
public class StorageSettings
{
    public string? SupabaseUrl { get; set; }
    public string? ServiceKey { get; set; }
    public string Bucket { get; set; } = "gymbro";

    public bool UseSupabase => !string.IsNullOrWhiteSpace(SupabaseUrl) && !string.IsNullOrWhiteSpace(ServiceKey);
}

public enum FileKind { Image, Document, Video }

public interface IFileStorage
{
    /// <summary>Validates type/size, stores the file under <paramref name="folder"/> with a generated name, and returns its public URL.</summary>
    Task<string> SaveAsync(IFormFile file, string folder, FileKind kind);

    /// <summary>Best-effort delete of a file previously returned by <see cref="SaveAsync"/>.</summary>
    Task DeleteAsync(string? url);
}

public class FileStorage(
    IOptions<StorageSettings> options,
    IHttpClientFactory httpFactory,
    IWebHostEnvironment env,
    IHttpContextAccessor http,
    ILogger<FileStorage> logger) : IFileStorage
{
    private readonly StorageSettings _s = options.Value;
    private static bool _bucketReady;

    private static readonly Dictionary<FileKind, (long MaxBytes, Dictionary<string, string> Types)> Rules = new()
    {
        [FileKind.Image] = (5 * 1024 * 1024, new()
        {
            ["image/jpeg"] = ".jpg", ["image/jpg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp", ["image/heic"] = ".heic",
        }),
        [FileKind.Document] = (10 * 1024 * 1024, new()
        {
            ["application/pdf"] = ".pdf", ["image/jpeg"] = ".jpg", ["image/jpg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp",
        }),
        [FileKind.Video] = (100 * 1024 * 1024, new()
        {
            ["video/mp4"] = ".mp4", ["video/quicktime"] = ".mov", ["video/webm"] = ".webm",
        }),
    };

    public async Task<string> SaveAsync(IFormFile file, string folder, FileKind kind)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("Choose a file to upload.");
        var (maxBytes, types) = Rules[kind];
        if (file.Length > maxBytes)
            throw new ArgumentException($"The file is too large (max {maxBytes / (1024 * 1024)} MB).");
        var contentType = (file.ContentType ?? string.Empty).ToLowerInvariant();
        if (!types.TryGetValue(contentType, out var ext))
            throw new ArgumentException($"This file type isn't allowed. Use {string.Join(", ", types.Values.Distinct()).ToUpperInvariant().Replace(".", "")}.");

        // Never trust the client's file name: generated name, folder made of safe segments only.
        var safeFolder = string.Join('/', folder.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => new string(p.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray()))
            .Where(p => p.Length > 0));
        var path = $"{safeFolder}/{Guid.NewGuid():N}{ext}";

        await using var stream = file.OpenReadStream();
        return _s.UseSupabase ? await SaveToSupabaseAsync(stream, path, contentType) : await SaveLocallyAsync(stream, path);
    }

    public async Task DeleteAsync(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            if (_s.UseSupabase)
            {
                var marker = $"/storage/v1/object/public/{_s.Bucket}/";
                var i = url.IndexOf(marker, StringComparison.Ordinal);
                if (i < 0) return;
                using var req = new HttpRequestMessage(HttpMethod.Delete, $"{Base}/storage/v1/object/{_s.Bucket}/{url[(i + marker.Length)..]}");
                Authorize(req);
                await httpFactory.CreateClient().SendAsync(req);
            }
            else
            {
                var i = url.IndexOf("/uploads/", StringComparison.Ordinal);
                if (i < 0) return;
                var full = Path.GetFullPath(Path.Combine(WebRoot, url[(i + 1)..]));
                if (full.StartsWith(WebRoot, StringComparison.Ordinal) && File.Exists(full)) File.Delete(full);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not delete stored file {Url}.", url);
        }
    }

    private string Base => _s.SupabaseUrl!.TrimEnd('/');
    private string WebRoot => env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");

    private void Authorize(HttpRequestMessage req)
    {
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _s.ServiceKey);
        req.Headers.Add("apikey", _s.ServiceKey);
    }

    private async Task<string> SaveToSupabaseAsync(Stream stream, string path, string contentType)
    {
        var client = httpFactory.CreateClient();
        await EnsureBucketAsync(client);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/storage/v1/object/{_s.Bucket}/{path}")
        {
            Content = new StreamContent(stream),
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        req.Headers.Add("x-upsert", "true");
        Authorize(req);
        var res = await client.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Supabase upload failed ({Status}): {Body}", (int)res.StatusCode, await res.Content.ReadAsStringAsync());
            throw new InvalidOperationException("The file couldn't be stored. Please try again.");
        }
        return $"{Base}/storage/v1/object/public/{_s.Bucket}/{path}";
    }

    /// <summary>Creates the public bucket on first use (an existing bucket is fine).</summary>
    private async Task EnsureBucketAsync(HttpClient client)
    {
        if (_bucketReady) return;
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/storage/v1/bucket")
        {
            Content = JsonContent.Create(new { id = _s.Bucket, name = _s.Bucket, @public = true }),
        };
        Authorize(req);
        var res = await client.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();
        if (res.IsSuccessStatusCode || body.Contains("already exists", StringComparison.OrdinalIgnoreCase) || body.Contains("Duplicate", StringComparison.OrdinalIgnoreCase))
            _bucketReady = true;
        else
            logger.LogWarning("Could not create storage bucket '{Bucket}' ({Status}): {Body}", _s.Bucket, (int)res.StatusCode, body);
    }

    private async Task<string> SaveLocallyAsync(Stream stream, string path)
    {
        var full = Path.Combine(WebRoot, "uploads", path.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        await using (var fs = File.Create(full)) await stream.CopyToAsync(fs);

        var req = http.HttpContext?.Request;
        var origin = req is null ? string.Empty : $"{req.Scheme}://{req.Host}";
        return $"{origin}/uploads/{path}";
    }
}
