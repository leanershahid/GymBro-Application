namespace GymManagmentApplication.Application.Trainer.Responses;

public class TrainerClientResponse
{
    public ulong AssignmentId { get; set; }
    public ulong ClientId { get; set; }
    public string Status { get; set; } = default!;
    public DateTime AssignedAt { get; set; }
}
