namespace GymManagmentApplication.Application.Trainer.Responses;

public class TrainerEarningsResponse
{
    public ulong TrainerId { get; set; }
    public decimal TotalEarnings { get; set; }
    public decimal CommissionEarned { get; set; }
    public int Month { get; set; }
    public int Year { get; set; }
}
