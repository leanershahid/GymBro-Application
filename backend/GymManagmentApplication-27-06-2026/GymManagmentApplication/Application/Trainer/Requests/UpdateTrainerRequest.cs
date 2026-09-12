namespace GymManagmentApplication.Application.Trainer.Requests;

public class UpdateTrainerRequest
{
    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? ProfileImage { get; set; }
    public bool? IsAvailable { get; set; }
}
