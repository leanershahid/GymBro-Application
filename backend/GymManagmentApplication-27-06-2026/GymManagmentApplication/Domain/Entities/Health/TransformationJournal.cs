using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Health;

public class TransformationJournal
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public DateOnly JournalDate { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public JsonDocument? Photos { get; set; }
    public JsonDocument? Tags { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Identity.User Client { get; set; } = default!;
}
