using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GymManagmentApplication.Infrastructure.Storage;

/// <summary>
/// "Storage" section. Where uploaded files go, first match wins:
/// <list type="number">
/// <item>Cloudinary — CloudinaryCloudName + CloudinaryApiKey + CloudinaryApiSecret
/// (Storage__CloudinaryCloudName, Storage__CloudinaryApiKey, Storage__CloudinaryApiSecret).</item>
/// <item>Supabase Storage — SupabaseUrl + ServiceKey (Storage__SupabaseUrl, Storage__ServiceKey).</item>
/// <item>wwwroot/uploads — fine locally; Render's disk is wiped on every deploy.</item>
/// </list>
/// The secrets stay on the server: uploads are signed here, never in the app.
/// </summary>
public class StorageSettings
{
    public string? CloudinaryCloudName { get; set; }
    public string? CloudinaryApiKey { get; set; }
    public string? CloudinaryApiSecret { get; set; }
    /// <summary>Top-level Cloudinary folder, so this app's files stay together.</summary>
    public string CloudinaryRootFolder { get; set; } = "gymbro";

    public string? SupabaseUrl { get; set; }
    public string? ServiceKey { get; set; }
    public string Bucket { get; set; } = "gymbro";

    public bool UseCloudinary =>
        !string.IsNullOrWhiteSpace(CloudinaryCloudName) && !string.IsNullOrWhiteSpace(CloudinaryApiKey) && !string.IsNullOrWhiteSpace(CloudinaryApiSecret);
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
        if (_s.UseCloudinary) return await SaveToCloudinaryAsync(stream, safeFolder, file.FileName, kind);
        return _s.UseSupabase ? await SaveToSupabaseAsync(stream, path, contentType) : await SaveLocallyAsync(stream, path);
    }

    public async Task DeleteAsync(string? url)
    {
        if (string.IsNullOrEmpty(url)) return;
        try
        {
            if (_s.UseCloudinary)
            {
                await DeleteFromCloudinaryAsync(url);
            }
            else if (_s.UseSupabase)
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

    // ── Cloudinary (signed uploads over its REST API) ──────────────────────

    private static string ResourceType(FileKind kind) => kind switch
    {
        FileKind.Video => "video",
        FileKind.Document => "auto",   // PDFs and images
        _ => "image",
    };

    /// <summary>Cloudinary's request signature: the sorted params, then the secret, SHA-1 in hex.</summary>
    private string Sign(SortedDictionary<string, string> parameters)
    {
        var toSign = string.Join('&', parameters.Select(p => $"{p.Key}={p.Value}")) + _s.CloudinaryApiSecret;
        return Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(toSign))).ToLowerInvariant();
    }

    private async Task<string> SaveToCloudinaryAsync(Stream stream, string folder, string? fileName, FileKind kind)
    {
        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["folder"] = $"{_s.CloudinaryRootFolder.Trim('/')}/{folder}".TrimEnd('/'),
            ["public_id"] = Guid.NewGuid().ToString("N"),
            ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
        };

        using var form = new MultipartFormDataContent();
        foreach (var (k, v) in parameters) form.Add(new StringContent(v), k);
        form.Add(new StringContent(_s.CloudinaryApiKey!), "api_key");
        form.Add(new StringContent(Sign(parameters)), "signature");
        form.Add(new StreamContent(stream), "file", string.IsNullOrWhiteSpace(fileName) ? "upload" : Path.GetFileName(fileName));

        var url = $"https://api.cloudinary.com/v1_1/{_s.CloudinaryCloudName}/{ResourceType(kind)}/upload";
        var res = await httpFactory.CreateClient().PostAsync(url, form);
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Cloudinary upload failed ({Status}): {Body}", (int)res.StatusCode, body);
            throw new InvalidOperationException("The file couldn't be stored. Please try again.");
        }
        using var json = JsonDocument.Parse(body);
        return json.RootElement.GetProperty("secure_url").GetString()
            ?? throw new InvalidOperationException("The file couldn't be stored. Please try again.");
    }

    /// <summary>
    /// Deletes by public id, read from a delivery URL like
    /// https://res.cloudinary.com/{cloud}/{type}/upload/v123/gymbro/folder/id.jpg.
    /// </summary>
    private async Task DeleteFromCloudinaryAsync(string url)
    {
        var marker = $"res.cloudinary.com/{_s.CloudinaryCloudName}/";
        var i = url.IndexOf(marker, StringComparison.Ordinal);
        if (i < 0) return;
        var parts = url[(i + marker.Length)..].Split('/');           // {type}/upload/v123/…/id.ext
        if (parts.Length < 4 || parts[1] != "upload") return;
        var rest = parts.Skip(2).SkipWhile(p => p.Length > 1 && p[0] == 'v' && p[1..].All(char.IsDigit));
        var publicId = string.Join('/', rest);
        var dot = publicId.LastIndexOf('.');
        if (dot > 0) publicId = publicId[..dot];

        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["public_id"] = publicId,
            ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
        };
        var fields = new Dictionary<string, string>(parameters)
        {
            ["api_key"] = _s.CloudinaryApiKey!,
            ["signature"] = Sign(parameters),
        };
        await httpFactory.CreateClient().PostAsync(
            $"https://api.cloudinary.com/v1_1/{_s.CloudinaryCloudName}/{parts[0]}/destroy", new FormUrlEncodedContent(fields));
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
