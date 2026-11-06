using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

using GymManagmentApplication.Application.Common;

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

    /// <summary>
    /// Storage__PrivateDocuments. When true, files uploaded as <see cref="FileKind.Document"/> (ID proofs,
    /// certificates) are stored privately — Cloudinary "authenticated" delivery, or the private Supabase
    /// bucket "{Bucket}-private" — and can only be opened through a signed URL from
    /// <see cref="IFileStorage.GetSignedUrlAsync"/> (GET api/uploads/signed-url). Off by default, because
    /// clients that open document URLs directly must call signed-url first. Images stay public.
    /// </summary>
    public bool PrivateDocuments { get; set; }
    /// <summary>How long a Supabase signed URL stays valid (Cloudinary signed URLs don't expire on standard plans).</summary>
    public int SignedUrlMinutes { get; set; } = 10;

    public bool UseCloudinary =>
        !string.IsNullOrWhiteSpace(CloudinaryCloudName) && !string.IsNullOrWhiteSpace(CloudinaryApiKey) && !string.IsNullOrWhiteSpace(CloudinaryApiSecret);
    public bool UseSupabase => !string.IsNullOrWhiteSpace(SupabaseUrl) && !string.IsNullOrWhiteSpace(ServiceKey);
}

public class FileStorage(
    IOptions<StorageSettings> options,
    IHttpClientFactory httpFactory,
    IWebHostEnvironment env,
    IHttpContextAccessor http,
    ILogger<FileStorage> logger) : IFileStorage
{
    /// <summary>Named HttpClient (registered in Program.cs with a long timeout, for video uploads).</summary>
    public const string HttpClientName = "storage";

    private readonly StorageSettings _s = options.Value;
    private static readonly HashSet<string> ReadyBuckets = [];

    private sealed record FileType(string ContentType, string Extension);

    private static readonly FileType Jpeg = new("image/jpeg", ".jpg");
    private static readonly FileType Png = new("image/png", ".png");
    private static readonly FileType Webp = new("image/webp", ".webp");
    private static readonly FileType Heic = new("image/heic", ".heic");
    private static readonly FileType Pdf = new("application/pdf", ".pdf");
    private static readonly FileType Mp4 = new("video/mp4", ".mp4");
    private static readonly FileType Mov = new("video/quicktime", ".mov");
    private static readonly FileType Webm = new("video/webm", ".webm");
    private static readonly FileType Zip = new("application/zip", ".zip");

    private static readonly Dictionary<FileKind, (long MaxBytes, FileType[] Types)> Rules = new()
    {
        [FileKind.Image] = (5 * 1024 * 1024, [Jpeg, Png, Webp, Heic]),
        [FileKind.Document] = (10 * 1024 * 1024, [Pdf, Jpeg, Png, Webp]),
        [FileKind.Video] = (100 * 1024 * 1024, [Mp4, Mov, Webm]),
        [FileKind.Archive] = (50 * 1024 * 1024, [Zip]),
    };

    public async Task<string> SaveAsync(FileUpload file, string folder, FileKind kind)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("Choose a file to upload.");
        var (maxBytes, types) = Rules[kind];
        if (file.Length > maxBytes)
            throw new ArgumentException($"The file is too large (max {maxBytes / (1024 * 1024)} MB).");

        // The file's own bytes decide its type; the client's Content-Type and name are ignored.
        var allowed = $"This file type isn't allowed. Use {string.Join(", ", types.Select(t => t.Extension.TrimStart('.').ToUpperInvariant()).Distinct())}.";
        var header = new byte[32];
        int read;
        await using (var probe = file.OpenReadStream())
            read = await probe.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
        var type = Sniff(header.AsSpan(0, read));
        if (type is null || !types.Contains(type)) throw new ArgumentException(allowed);

        // Never trust the client's file name: generated name, folder made of safe segments only.
        var safeFolder = string.Join('/', folder.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(p => new string(p.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray()))
            .Where(p => p.Length > 0));
        var path = $"{safeFolder}/{Guid.NewGuid():N}{type.Extension}";
        // Generated archives (data exports) are personal data: always private, whatever PrivateDocuments says.
        var isPrivate = kind == FileKind.Archive || (_s.PrivateDocuments && kind == FileKind.Document);

        await using var stream = file.OpenReadStream();
        if (_s.UseCloudinary) return await SaveToCloudinaryAsync(stream, safeFolder, type, kind, isPrivate);
        return _s.UseSupabase ? await SaveToSupabaseAsync(stream, path, type.ContentType, isPrivate) : await SaveLocallyAsync(stream, path);
    }

    /// <summary>Recognises the allowed formats by their magic numbers; null for anything else.</summary>
    private static FileType? Sniff(ReadOnlySpan<byte> b)
    {
        static bool At(ReadOnlySpan<byte> data, int offset, string ascii) =>
            data.Length >= offset + ascii.Length && data.Slice(offset, ascii.Length).SequenceEqual(Encoding.ASCII.GetBytes(ascii));

        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return Jpeg;
        if (b.Length >= 8 && b[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return Png;
        if (At(b, 0, "RIFF") && At(b, 8, "WEBP")) return Webp;
        if (At(b, 0, "%PDF-")) return Pdf;
        if (b.Length >= 4 && b[0] == 0x50 && b[1] == 0x4B && b[2] == 0x03 && b[3] == 0x04) return Zip;
        if (b.Length >= 4 && b[0] == 0x1A && b[1] == 0x45 && b[2] == 0xDF && b[3] == 0xA3) return Webm;
        if (At(b, 4, "ftyp") && b.Length >= 12)
        {
            var brand = Encoding.ASCII.GetString(b.Slice(8, 4));
            if (brand is "heic" or "heix" or "heim" or "heis" or "hevc" or "hevx" or "mif1" or "msf1") return Heic;
            if (brand == "qt  ") return Mov;
            return Mp4; // isom, mp41, mp42, avc1, M4V, 3gp…
        }
        // Older QuickTime files start with other atoms.
        if (At(b, 4, "moov") || At(b, 4, "mdat") || At(b, 4, "wide") || At(b, 4, "free")) return Mov;
        return null;
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
                foreach (var bucket in new[] { _s.Bucket, PrivateBucket })
                {
                    if (SupabaseObjectPath(url, bucket) is not { } objectPath) continue;
                    using var req = new HttpRequestMessage(HttpMethod.Delete, $"{Base}/storage/v1/object/{bucket}/{objectPath}");
                    Authorize(req);
                    await Client.SendAsync(req);
                    return;
                }
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

    public async Task<string> GetSignedUrlAsync(string url)
    {
        if (_s.UseCloudinary && url.Contains("/authenticated/", StringComparison.Ordinal))
            return SignCloudinaryUrl(url) ?? url;

        if (_s.UseSupabase && SupabaseObjectPath(url, PrivateBucket) is { } objectPath)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/storage/v1/object/sign/{PrivateBucket}/{objectPath}")
            {
                Content = JsonContent.Create(new { expiresIn = Math.Max(60, _s.SignedUrlMinutes * 60) }),
            };
            Authorize(req);
            var res = await Client.SendAsync(req);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                logger.LogError("Supabase signed URL failed ({Status}).", (int)res.StatusCode);
                throw new HttpRequestException("The file link couldn't be created. Please try again.");
            }
            using var json = JsonDocument.Parse(body);
            var signed = json.RootElement.TryGetProperty("signedURL", out var s) ? s.GetString() : null;
            if (string.IsNullOrEmpty(signed)) throw new HttpRequestException("The file link couldn't be created. Please try again.");
            return signed.StartsWith("http", StringComparison.Ordinal) ? signed : $"{Base}/storage/v1{signed}";
        }

        return url;
    }

    private HttpClient Client => httpFactory.CreateClient(HttpClientName);
    private string Base => _s.SupabaseUrl!.TrimEnd('/');
    private string PrivateBucket => _s.Bucket + "-private";
    private string WebRoot => env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");

    /// <summary>The object path inside <paramref name="bucket"/> for a URL returned by SaveAsync (public or private form).</summary>
    private static string? SupabaseObjectPath(string url, string bucket)
    {
        foreach (var marker in new[] { $"/storage/v1/object/public/{bucket}/", $"/storage/v1/object/authenticated/{bucket}/" })
        {
            var i = url.IndexOf(marker, StringComparison.Ordinal);
            if (i >= 0) return url[(i + marker.Length)..].Split('?')[0];
        }
        return null;
    }

    private void Authorize(HttpRequestMessage req)
    {
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _s.ServiceKey);
        req.Headers.Add("apikey", _s.ServiceKey);
    }

    private async Task<string> SaveToSupabaseAsync(Stream stream, string path, string contentType, bool isPrivate)
    {
        var bucket = isPrivate ? PrivateBucket : _s.Bucket;
        await EnsureBucketAsync(bucket, isPublic: !isPrivate);

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/storage/v1/object/{bucket}/{path}")
        {
            Content = new StreamContent(stream),
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        req.Headers.Add("x-upsert", "true");
        Authorize(req);
        var res = await Client.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Supabase upload failed ({Status}): {Body}", (int)res.StatusCode, await res.Content.ReadAsStringAsync());
            throw new HttpRequestException("The file couldn't be stored. Please try again.");
        }
        // A private object's URL only identifies it; it opens through GetSignedUrlAsync.
        return $"{Base}/storage/v1/object/{(isPrivate ? "authenticated" : "public")}/{bucket}/{path}";
    }

    /// <summary>Creates the bucket on first use (an existing bucket is fine).</summary>
    private async Task EnsureBucketAsync(string bucket, bool isPublic)
    {
        lock (ReadyBuckets) if (ReadyBuckets.Contains(bucket)) return;
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/storage/v1/bucket")
        {
            Content = JsonContent.Create(new { id = bucket, name = bucket, @public = isPublic }),
        };
        Authorize(req);
        var res = await Client.SendAsync(req);
        var body = await res.Content.ReadAsStringAsync();
        if (res.IsSuccessStatusCode || body.Contains("already exists", StringComparison.OrdinalIgnoreCase) || body.Contains("Duplicate", StringComparison.OrdinalIgnoreCase))
            lock (ReadyBuckets) ReadyBuckets.Add(bucket);
        else
            logger.LogWarning("Could not create storage bucket '{Bucket}' ({Status}): {Body}", bucket, (int)res.StatusCode, body);
    }

    // ── Cloudinary (signed uploads over its REST API) ──────────────────────

    private static string ResourceType(FileKind kind) => kind switch
    {
        FileKind.Video => "video",
        FileKind.Document => "auto",   // PDFs and images
        FileKind.Archive => "raw",     // ZIP data exports
        _ => "image",
    };

    /// <summary>Cloudinary's request signature: the sorted params, then the secret, SHA-1 in hex.</summary>
    private string Sign(SortedDictionary<string, string> parameters)
    {
        var toSign = string.Join('&', parameters.Select(p => $"{p.Key}={p.Value}")) + _s.CloudinaryApiSecret;
        return Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(toSign))).ToLowerInvariant();
    }

    private async Task<string> SaveToCloudinaryAsync(Stream stream, string folder, FileType type, FileKind kind, bool isPrivate)
    {
        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["folder"] = $"{_s.CloudinaryRootFolder.Trim('/')}/{folder}".TrimEnd('/'),
            ["public_id"] = Guid.NewGuid().ToString("N"),
            ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
        };
        if (isPrivate) parameters["type"] = "authenticated";

        using var form = new MultipartFormDataContent();
        foreach (var (k, v) in parameters) form.Add(new StringContent(v), k);
        form.Add(new StringContent(_s.CloudinaryApiKey!), "api_key");
        form.Add(new StringContent(Sign(parameters)), "signature");
        var content = new StreamContent(stream);
        content.Headers.ContentType = new MediaTypeHeaderValue(type.ContentType);
        form.Add(content, "file", "upload" + type.Extension);

        var url = $"https://api.cloudinary.com/v1_1/{_s.CloudinaryCloudName}/{ResourceType(kind)}/upload";
        var res = await Client.PostAsync(url, form);
        var body = await res.Content.ReadAsStringAsync();
        if (!res.IsSuccessStatusCode)
        {
            logger.LogError("Cloudinary upload failed ({Status}): {Body}", (int)res.StatusCode, body);
            throw new HttpRequestException("The file couldn't be stored. Please try again.");
        }
        using var json = JsonDocument.Parse(body);
        return json.RootElement.GetProperty("secure_url").GetString()
            ?? throw new HttpRequestException("The file couldn't be stored. Please try again.");
    }

    /// <summary>
    /// Signed delivery URL for an "authenticated" asset:
    /// https://res.cloudinary.com/{cloud}/{type}/authenticated/s--SIG--/v123/folder/id.pdf, where SIG is the
    /// first 8 chars of URL-safe base64(SHA-1("folder/id.pdf" + api secret)).
    /// </summary>
    private string? SignCloudinaryUrl(string url)
    {
        var marker = "/authenticated/";
        var i = url.IndexOf(marker, StringComparison.Ordinal);
        if (i < 0) return null;
        var prefix = url[..(i + marker.Length)];
        var parts = url[(i + marker.Length)..].Split('?')[0].Split('/').Where(p => !p.StartsWith("s--", StringComparison.Ordinal)).ToList();
        var version = parts.Count > 0 && IsVersion(parts[0]) ? parts[0] : null;
        var source = string.Join('/', version is null ? parts : parts.Skip(1));
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(source + _s.CloudinaryApiSecret));
        var signature = Convert.ToBase64String(hash).Replace('+', '-').Replace('/', '_')[..8];
        return $"{prefix}s--{signature}--/{(version is null ? "" : version + "/")}{source}";
    }

    private static bool IsVersion(string p) => p.Length > 1 && p[0] == 'v' && p[1..].All(char.IsDigit);

    /// <summary>
    /// Deletes by public id, read from a delivery URL like
    /// https://res.cloudinary.com/{cloud}/{type}/upload/v123/gymbro/folder/id.jpg (or …/authenticated/…).
    /// </summary>
    private async Task DeleteFromCloudinaryAsync(string url)
    {
        var marker = $"res.cloudinary.com/{_s.CloudinaryCloudName}/";
        var i = url.IndexOf(marker, StringComparison.Ordinal);
        if (i < 0) return;
        var parts = url[(i + marker.Length)..].Split('?')[0].Split('/');   // {type}/{upload|authenticated}/v123/…/id.ext
        if (parts.Length < 4 || parts[1] is not ("upload" or "authenticated")) return;
        var rest = parts.Skip(2).Where(p => !p.StartsWith("s--", StringComparison.Ordinal)).SkipWhile(IsVersion);
        var publicId = string.Join('/', rest);
        var dot = publicId.LastIndexOf('.');
        if (dot > 0) publicId = publicId[..dot];

        var parameters = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["public_id"] = publicId,
            ["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
        };
        if (parts[1] == "authenticated") parameters["type"] = "authenticated";
        var fields = new Dictionary<string, string>(parameters)
        {
            ["api_key"] = _s.CloudinaryApiKey!,
            ["signature"] = Sign(parameters),
        };
        await Client.PostAsync(
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
