namespace GymManagmentApplication.Application.AiCoach.Requests;

public class AiCoachSettingsRequest
{
    public string HighTip { get; set; } = default!;
    public string MediumTip { get; set; } = default!;
    public string LowTip { get; set; } = default!;
}
