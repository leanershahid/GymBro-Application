namespace GymManagmentApplication.Application.Onboarding.Requests;

public class StartOnboardingRequest
{
    public ulong MemberId { get; set; }
    public ulong TenantId { get; set; }
    public ulong? TemplateId { get; set; }
}

public class SubmitOnboardingStepRequest
{
    public string StepKey { get; set; } = default!;
    public object Data { get; set; } = default!;
}

public class SubmitAssessmentRequest
{
    public ulong MemberId { get; set; }
    public ulong TemplateId { get; set; }
    public object Responses { get; set; } = default!;
    public string? Notes { get; set; }
}

public class CreateOnboardingTemplateRequest
{
    public ulong TenantId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public List<TemplateStepRequest> Steps { get; set; } = [];
}

public class TemplateStepRequest
{
    public string StepKey { get; set; } = default!;
    public string Label { get; set; } = default!;
    public bool IsRequired { get; set; } = true;
    public byte SortOrder { get; set; }
}
