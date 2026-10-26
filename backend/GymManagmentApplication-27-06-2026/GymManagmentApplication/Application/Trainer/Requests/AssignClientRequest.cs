namespace GymManagmentApplication.Application.Trainer.Requests;

public class AssignClientRequest
{
    public ulong ClientId { get; set; }
    /// <summary>Optional; defaults to the trainer's branch.</summary>
    public ulong BranchId { get; set; }
    public string? Notes { get; set; }
}
