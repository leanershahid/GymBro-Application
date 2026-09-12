namespace GymManagmentApplication.Domain.Entities.Platform;

public class OnboardingStep
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public string StepKey { get; set; } = default!;
    public string Label { get; set; } = default!;
    public bool IsRequired { get; set; } = true;
    public bool IsDone { get; set; }
    public DateTime? DoneAt { get; set; }
    public byte SortOrder { get; set; }

    public Core.Tenant Tenant { get; set; } = default!;
}
