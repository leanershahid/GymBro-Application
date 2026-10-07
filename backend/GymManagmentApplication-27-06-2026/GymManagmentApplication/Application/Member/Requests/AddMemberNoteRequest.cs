namespace GymManagmentApplication.Application.Member.Requests;

public class AddMemberNoteRequest
{
    public string Note { get; set; } = default!;
    /// <summary>Ignored — the note's author is always the signed-in user.</summary>
    public ulong TrainerId { get; set; }
}
