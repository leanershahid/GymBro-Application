using System.Text.Json;

namespace GymManagmentApplication.Domain.Entities.Communication;

public class FeedbackResponse
{
    public ulong Id { get; set; }
    public ulong SurveyId { get; set; }
    public ulong UserId { get; set; }
    public sbyte? Score { get; set; }
    public JsonDocument? Responses { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public FeedbackSurvey Survey { get; set; } = default!;
    public Identity.User User { get; set; } = default!;
}
