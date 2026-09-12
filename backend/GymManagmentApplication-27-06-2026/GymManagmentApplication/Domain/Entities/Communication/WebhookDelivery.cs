using GymManagmentApplication.Domain.Enums;
using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class WebhookDelivery
{
    public ulong Id { get; set; }
    public ulong WebhookId { get; set; }
    public string EventType { get; set; } = default!;
    public JsonDocument? Payload { get; set; }
    public ushort? ResponseCode { get; set; }
    public string? ResponseBody { get; set; }
    public WebhookDeliveryStatus Status { get; set; } = WebhookDeliveryStatus.Pending;
    public byte Attempt { get; set; } = 1;
    public DateTime? DeliveredAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Webhook Webhook { get; set; } = default!;
}
