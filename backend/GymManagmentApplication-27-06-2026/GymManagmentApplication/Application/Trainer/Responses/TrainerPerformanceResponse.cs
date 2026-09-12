namespace GymManagmentApplication.Application.Trainer.Responses;

public class TrainerPerformanceResponse
{
    public ulong TrainerId { get; set; }
    public int TotalClients { get; set; }
    public uint TotalSessions { get; set; }
    public decimal? Rating { get; set; }
}
