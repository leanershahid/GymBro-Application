namespace GymManagmentApplication.Application.Member.Requests;

public class AddMemberNoteRequest
{
    public string Note { get; set; } = default!;
    public ulong TrainerId { get; set; }
}
