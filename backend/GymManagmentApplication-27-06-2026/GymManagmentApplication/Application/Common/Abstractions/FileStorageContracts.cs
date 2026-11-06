namespace GymManagmentApplication.Application.Common;

/// <summary>
/// An uploaded file as the Application layer sees it (ARCH-097): name, declared type, size and a
/// way to (re)open its content. Controllers adapt ASP.NET's FileUpload with <c>ToUpload()</c>, so
/// service interfaces carry no HTTP types and can be called from jobs or tests with any stream.
/// </summary>
/// <param name="OpenReadStream">Opens a fresh read stream; may be called more than once (sniffing, then storing).</param>
public sealed record FileUpload(string FileName, string? ContentType, long Length, Func<Stream> OpenReadStream)
{
    /// <summary>An in-memory upload (tests, generated files).</summary>
    public static FileUpload FromBytes(string fileName, string? contentType, byte[] content) =>
        new(fileName, contentType, content.LongLength, () => new MemoryStream(content, writable: false));
}

/// <summary>
/// <see cref="Archive"/> = a ZIP the server generated (data exports): always stored privately
/// (Cloudinary "authenticated" raw asset / private Supabase bucket) and opened only through
/// <see cref="IFileStorage.GetSignedUrlAsync"/>.
/// </summary>
public enum FileKind { Image, Document, Video, Archive }

public interface IFileStorage
{
    /// <summary>
    /// Validates size and type — the type from the file's first bytes (magic number), not the client's
    /// Content-Type or file name — stores the file under <paramref name="folder"/> with a generated name,
    /// and returns its URL.
    /// </summary>
    Task<string> SaveAsync(FileUpload file, string folder, FileKind kind);

    /// <summary>Best-effort delete of a file previously returned by <see cref="SaveAsync"/>.</summary>
    Task DeleteAsync(string? url);

    /// <summary>
    /// A URL that can be opened for a stored file: a signed (and on Supabase, short-lived) URL for a
    /// private document, or the URL itself for public files.
    /// </summary>
    Task<string> GetSignedUrlAsync(string url);
}
