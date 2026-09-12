namespace GymManagmentApplication.Application.Trainer.Requests;

public class AssignClientRequest
{
    public ulong ClientId { get; set; }
    public ulong BranchId { get; set; }
    public string? Notes { get; set; }
}
