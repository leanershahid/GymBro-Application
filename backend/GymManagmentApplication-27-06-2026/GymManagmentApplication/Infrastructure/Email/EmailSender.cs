using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace GymManagmentApplication.Infrastructure.Email;

/// <summary>SMTP settings ("Email" section / Email__Host … env vars). Works with any SMTP provider (Gmail app password, Brevo, SES, Resend…).</summary>
public class EmailSettings
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string From { get; set; } = "no-reply@gymbro.app";
    public string FromName { get; set; } = "GymBro";
    public bool EnableSsl { get; set; } = true;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host);
}

public interface IEmailSender
{
    /// <summary>Sends an email; returns false (and logs) when delivery fails or email isn't configured.</summary>
    Task<bool> SendAsync(string to, string subject, string htmlBody, IReadOnlyList<(string Name, byte[] Content, string MediaType)>? attachments = null);
}

public class SmtpEmailSender(IOptions<EmailSettings> options, ILogger<SmtpEmailSender> logger, IHostEnvironment env) : IEmailSender
{
    private readonly EmailSettings _s = options.Value;

    public async Task<bool> SendAsync(string to, string subject, string htmlBody, IReadOnlyList<(string Name, byte[] Content, string MediaType)>? attachments = null)
    {
        if (!_s.IsConfigured)
        {
            // Without SMTP nothing can be delivered. In Development, log the mail so codes can be used locally.
            if (env.IsDevelopment())
                logger.LogWarning("Email not configured — would send to {To}: {Subject}\n{Body}", to, subject, htmlBody);
            else
                logger.LogError("Email not configured (set Email__Host etc.) — could not send '{Subject}' to {To}.", subject, to);
            return false;
        }

        try
        {
            using var msg = new MailMessage
            {
                From = new MailAddress(_s.From, _s.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
            };
            msg.To.Add(to);
            foreach (var (name, content, type) in attachments ?? [])
                msg.Attachments.Add(new Attachment(new MemoryStream(content), name, type));

            using var client = new SmtpClient(_s.Host, _s.Port)
            {
                EnableSsl = _s.EnableSsl,
                Credentials = string.IsNullOrEmpty(_s.Username) ? null : new NetworkCredential(_s.Username, _s.Password),
            };
            await client.SendMailAsync(msg);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send email '{Subject}' to {To}.", subject, to);
            return false;
        }
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
