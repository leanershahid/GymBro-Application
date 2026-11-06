using System.Net;

namespace GymManagmentApplication.Application.Common;

public interface IEmailSender
{
    /// <summary>Sends an email; returns false (and logs) when delivery fails or email isn't configured.</summary>
    Task<bool> SendAsync(string to, string subject, string htmlBody, IReadOnlyList<(string Name, byte[] Content, string MediaType)>? attachments = null);
}

/// <summary>
/// Transactional outbox for email (ARCH-046). <see cref="Enqueue"/> adds a Queued
/// <c>CommunicationLog</c> row to the caller's unit of work, so the email exists only if the
/// caller's SaveChanges commits; <c>EmailOutboxProcessor</c> (Infrastructure) then delivers it in the
/// background with retries, off the request path.
/// </summary>
public interface IEmailOutbox
{
    /// <param name="dedupeKey">Optional key (kept in ProviderRef): <see cref="AlreadyQueuedAsync"/> finds it later.</param>
    void Enqueue(ulong tenantId, ulong? userId, string to, string subject, string htmlBody, string? dedupeKey = null);

    /// <summary>The subset of <paramref name="dedupeKeys"/> already queued or sent for this gym.</summary>
    Task<HashSet<string>> AlreadyQueuedAsync(ulong tenantId, IReadOnlyCollection<string> dedupeKeys, CancellationToken ct = default);
}

/// <summary>Log-safe forms of personal data (ARCH-048).</summary>
public static class LogMask
{
    /// <summary>"jo***@gym.com" — enough to tell recipients apart, not enough to harvest.</summary>
    public static string Email(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "(none)";
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        return (local.Length <= 2 ? local[..1] : local[..2]) + "***" + email[at..];
    }
}

/// <summary>Minimal branded HTML wrapper for transactional emails.</summary>
public static class EmailTemplates
{
    public static string Code(string heading, string intro, string code, int validMinutes) => Wrap(heading, $"""
        <p style="margin:0 0 16px">{WebUtility.HtmlEncode(intro)}</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:0 0 16px;color:#0A0F0A">{code}</p>
        <p style="margin:0;color:#6B726B">This code expires in {validMinutes} minutes. If you didn't ask for it, you can ignore this email.</p>
        """);

    public static string Wrap(string heading, string innerHtml) => $"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <div style="font-size:20px;font-weight:800;color:#7B990B;margin-bottom:8px">GymBro</div>
          <h2 style="margin:0 0 12px;color:#0A0F0A">{WebUtility.HtmlEncode(heading)}</h2>
          {innerHtml}
        </div>
        """;
}
