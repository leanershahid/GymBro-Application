namespace GymManagmentApplication.Application.Member.Responses;

public class MemberNoteResponse
{
    public ulong Id { get; set; }
    public string Note { get; set; } = default!;
    public ulong TrainerId { get; set; }
    public DateTime CreatedAt { get; set; }
}
