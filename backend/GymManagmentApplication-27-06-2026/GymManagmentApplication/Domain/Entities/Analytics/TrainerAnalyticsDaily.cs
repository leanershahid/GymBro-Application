namespace GymManagmentApplication.Domain.Entities.Analytics;

public class TrainerAnalyticsDaily
{
    public ulong Id { get; set; }
    public ulong TrainerId { get; set; }
    public DateOnly ReportDate { get; set; }
    public ushort SessionsDone { get; set; }
    public ushort ClientsTrained { get; set; }
    public decimal? AvgRating { get; set; }
    public ushort WorkoutsCreated { get; set; }
    public decimal RevenueGenerated { get; set; }

    public Training.TrainerProfile Trainer { get; set; } = default!;
}
