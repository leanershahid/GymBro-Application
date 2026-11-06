using System.Text.Json;
using System.Text.Json.Serialization;

namespace GymManagmentApplication.Application.Engagement;

/// <summary>What a queued push row (CommunicationLog.Meta, Channel = Push) carries.</summary>
public sealed class PushMeta
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public string? Kind { get; set; }
    public ulong? RefId { get; set; }
    public string? Route { get; set; }
    public string Category { get; set; } = NotificationCategories.General;
    /// <summary>Service alerts that skip quiet hours (class cancelled today, waitlist offer).</summary>
    public bool Urgent { get; set; }
    /// <summary>Not worth sending after this (UTC), e.g. a reminder once the class has started.</summary>
    public DateTime? ExpiresAt { get; set; }
    /// <summary>Set by the outbox: why the row was not sent (opted_out, no_device, expired, error).</summary>
    public string? Reason { get; set; }
    /// <summary>Set by the outbox: Expo ticket id → token, for the receipts check.</summary>
    public Dictionary<string, string>? Tickets { get; set; }
    public bool ReceiptsChecked { get; set; }

    public static PushMeta From(JsonDocument? doc) =>
        doc is null ? new PushMeta() : doc.Deserialize<PushMeta>(Json) ?? new PushMeta();

    public JsonDocument ToDocument() => JsonSerializer.SerializeToDocument(this, Json);
}

/// <summary>
/// Screen keys the app opens when a notification is tapped (push payload "route" and the in-app
/// list's Route). Semantic, not URLs, so the app's own routing can change without the server:
/// <list type="bullet">
/// <item>"classes/{classId}" — a class booking / reminder / waitlist (member: My bookings)</item>
/// <item>"classes/{classId}/offer" — a waitlist offer to claim</item>
/// <item>"pt/{sessionId}" or "pt" — a personal-training session</item>
/// <item>"billing" — invoices / membership</item>
/// <item>"my-bookings" — member: Book → My bookings (late-cancel / no-show fee, strike, booking block)</item>
/// <item>"training" — assigned workout / plan</item>
/// <item>"members/{userId}" — staff: a member's profile (health clearance)</item>
/// <item>"message-thread/{conversationId}" — a trainer ↔ member message</item>
/// <item>"notifications" — anything else: the alerts list</item>
/// </list>
/// </summary>
public static class PushRoutes
{
    public static string For(string? kind, ulong? refId) => kind switch
    {
        "booking" or "class" or "class_reminder" or "waitlist" => refId is { } c ? $"classes/{c}" : "classes",
        "waitlist_offer" => refId is { } o ? $"classes/{o}/offer" : "classes",
        "pt" or "pt_reminder" => refId is { } p ? $"pt/{p}" : "pt",
        "billing" or "invoice" or "payment" => "billing",
        "training" => "training",
        "announcement" => refId is { } a ? $"announcements/{a}" : "announcements",
        "health" => refId is { } m ? $"members/{m}" : "notifications",
        // Self-service: the member opens their request; staff open the queue.
        "membership_request" => refId is { } q ? $"membership-request/{q}" : "my-membership",
        "membership_request_staff" => "membership-requests",
        // Facilities: the reporter opens their report; staff open it in the triage queue.
        // Cancellation / no-show rules: fees, strikes, booking blocks → the member's My bookings tab.
        "booking_penalty" => "my-bookings",
        "facility_report" => refId is { } fr ? $"my-report/{fr}" : "my-reports",
        "facility_report_staff" => refId is { } fs ? $"facility-report/{fs}" : "facility-reports",
        // Help & feedback: the member opens their request; staff / trainers open it in the queue; the digest opens the queue.
        "support" => refId is { } h ? $"help-request/{h}" : "help",
        "support_staff" => refId is { } t ? $"support-request/{t}" : "support",
        "support_digest" => "support",
        // Messaging: either participant opens the thread (same key in the member and trainer apps).
        "message" => refId is { } mt ? $"message-thread/{mt}" : "messages",
        _ => "notifications",
    };
}

/// <summary>Sends pushes through Expo's push service (Infrastructure implements it).</summary>
public interface IPushSender
{
    /// <summary>Sends up to 100 messages; one ticket per message, in order.</summary>
    Task<IReadOnlyList<PushTicket>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken ct = default);

    /// <summary>Receipts for earlier tickets: id → result (ids Expo doesn't know yet are missing).</summary>
    Task<IReadOnlyDictionary<string, PushTicket>> GetReceiptsAsync(IReadOnlyCollection<string> ticketIds, CancellationToken ct = default);
}

public sealed record PushMessage(string To, string Title, string? Body, IReadOnlyDictionary<string, object?> Data, bool HighPriority);

/// <param name="Ok">Accepted by Expo (ticket) / delivered to Apple/Google (receipt).</param>
/// <param name="Id">Ticket id (tickets only).</param>
/// <param name="Error">Expo error code, e.g. "DeviceNotRegistered", "MessageRateExceeded".</param>
public sealed record PushTicket(bool Ok, string? Id, string? Error, string? Message);
