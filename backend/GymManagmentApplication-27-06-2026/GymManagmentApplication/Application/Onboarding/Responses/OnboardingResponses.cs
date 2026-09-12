namespace GymManagmentApplication.Application.Onboarding.Responses;

public class OnboardingStatusResponse
{
    public ulong MemberId { get; set; }
    public string CurrentStep { get; set; } = default!;
    public int TotalSteps { get; set; }
    public int CompletedSteps { get; set; }
    public bool IsComplete { get; set; }
}

public class OnboardingTemplateResponse
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public List<TemplateStepResponse> Steps { get; set; } = [];
}

public class TemplateStepResponse
{
    public string StepKey { get; set; } = default!;
    public string Label { get; set; } = default!;
    public bool IsRequired { get; set; }
    public byte SortOrder { get; set; }
}

public class AssessmentResponse
{
    public ulong Id { get; set; }
    public ulong MemberId { get; set; }
    public ulong TemplateId { get; set; }
    public decimal? Score { get; set; }
    public string? Notes { get; set; }
    public DateTime AssessedAt { get; set; }
}
