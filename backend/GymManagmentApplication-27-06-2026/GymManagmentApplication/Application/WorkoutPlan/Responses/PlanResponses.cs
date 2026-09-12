namespace GymManagmentApplication.Application.WorkoutPlan.Responses;

public class PlanResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public byte DurationWeeks { get; set; }
    public string Goal { get; set; } = default!;
    public string Difficulty { get; set; } = default!;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PlanTreeResponse
{
    public ulong PlanId { get; set; }
    public List<PlanTreeNode> Nodes { get; set; } = [];
}

public class PlanTreeNode
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string Type { get; set; } = default!;
    public List<PlanTreeNode> Children { get; set; } = [];
}

public class PlanMemberResponse
{
    public ulong AssignmentId { get; set; }
    public ulong ClientId { get; set; }
    public DateOnly StartDate { get; set; }
    public string Status { get; set; } = default!;
}

public class PlanAnalyticsResponse
{
    public ulong PlanId { get; set; }
    public int TotalAssigned { get; set; }
    public int Completed { get; set; }
    public int InProgress { get; set; }
    public double CompletionRate { get; set; }
}
