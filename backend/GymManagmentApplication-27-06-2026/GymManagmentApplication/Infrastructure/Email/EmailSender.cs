using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

using GymManagmentApplication.Application.Common;

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

public class SmtpEmailSender(IOptions<EmailSettings> options, ILogger<SmtpEmailSender> logger, IHostEnvironment env) : IEmailSender
{
    private readonly EmailSettings _s = options.Value;

    public async Task<bool> SendAsync(string to, string subject, string htmlBody, IReadOnlyList<(string Name, byte[] Content, string MediaType)>? attachments = null)
    {
        if (!_s.IsConfigured)
        {
            // Without SMTP nothing can be delivered. In Development, log the mail so codes can be used locally.
            if (env.IsDevelopment())
                logger.LogWarning("Email not configured — would send to {To}: {Subject}\n{Body}", LogMask.Email(to), subject, htmlBody);
            else
                logger.LogError("Email not configured (set Email__Host etc.) — could not send '{Subject}' to {To}.", subject, LogMask.Email(to));
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
            logger.LogError(ex, "Failed to send email '{Subject}' to {To}.", subject, LogMask.Email(to));
            return false;
        }
    }
}
