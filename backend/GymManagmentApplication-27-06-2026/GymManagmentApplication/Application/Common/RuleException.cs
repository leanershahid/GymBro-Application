namespace GymManagmentApplication.Application.Common;

/// <summary>
/// A business rule the request broke, carrying the HTTP status to answer with (ARCH-096):
/// 409 for conflicts (stock, duplicates, full), 422 for rules (empty cart, status moves …).
/// 400 / 403 / 404 keep using ArgumentException / UnauthorizedAccessException / KeyNotFoundException.
/// Mapped for every controller by the global <c>RuleExceptionFilter</c> (registered in
/// <see cref="DataServicesRegistration"/>); no ASP.NET types are needed to throw it.
/// </summary>
public class RuleException(string message, int statusCode) : Exception(message)
{
    public const int ConflictStatus = 409;
    public const int UnprocessableStatus = 422;

    public int StatusCode { get; } = statusCode;

    /// <summary>Optional machine-readable code, returned as the envelope's <c>code</c>.</summary>
    public string? Code { get; init; }

    /// <summary>Optional payload returned as the envelope's <c>data</c> (e.g. what is missing).</summary>
    public object? Payload { get; init; }

    public static RuleException Conflict(string message) => new(message, ConflictStatus);
    public static RuleException Unprocessable(string message) => new(message, UnprocessableStatus);
}
