using System.Text.Json;
using GymManagmentApplication.Application.Onboarding.Interfaces;
using GymManagmentApplication.Application.Onboarding.Requests;
using GymManagmentApplication.Application.Onboarding.Responses;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Infrastructure.Repositories.Onboarding;

namespace GymManagmentApplication.Application.Onboarding.Services;

public class OnboardingService(IOnboardingRepository repository) : IOnboardingService
{
    private static readonly string[] DefaultSteps = ["profile", "goals", "health", "payment", "agreement"];

    public async Task<OnboardingStatusResponse> StartAsync(StartOnboardingRequest request)
    {
        var steps = DefaultSteps.Select((key, i) => new OnboardingStep
        {
            TenantId = request.MemberId, // reusing TenantId as memberId key for in-memory
            StepKey = key,
            Label = key,
            SortOrder = (byte)i,
            IsRequired = true
        }).ToList();
        await repository.CreateStepsAsync(steps);
        return BuildStatus(request.MemberId, steps);
    }

    public async Task<OnboardingStatusResponse?> GetStatusAsync(ulong memberId)
    {
        var steps = await repository.GetStepsByMemberAsync(memberId);
        return steps.Count == 0 ? null : BuildStatus(memberId, steps);
    }

    public async Task<OnboardingStatusResponse?> SubmitStepAsync(ulong memberId, SubmitOnboardingStepRequest request)
    {
        var step = await repository.GetStepAsync(memberId, request.StepKey);
        if (step is null) return null;
        step.IsDone = true;
        step.DoneAt = DateTime.UtcNow;
        await repository.UpdateStepAsync(step);
        var steps = await repository.GetStepsByMemberAsync(memberId);
        return BuildStatus(memberId, steps);
    }

    public async Task<AssessmentResponse> SubmitAssessmentAsync(SubmitAssessmentRequest request)
    {
        var assessment = new ClientAssessment
        {
            ClientId = request.MemberId,
            TemplateId = request.TemplateId,
            Responses = JsonDocument.Parse(JsonSerializer.Serialize(request.Responses)),
            Notes = request.Notes
        };
        var created = await repository.CreateAssessmentAsync(assessment);
        return new AssessmentResponse { Id = created.Id, MemberId = created.ClientId, TemplateId = created.TemplateId, Score = created.Score, Notes = created.Notes, AssessedAt = created.AssessedAt };
    }

    public async Task<List<OnboardingTemplateResponse>> GetTemplatesAsync(ulong tenantId)
    {
        var templates = await repository.GetTemplatesAsync(tenantId);
        return templates.Select(MapTemplate).ToList();
    }

    public async Task<OnboardingTemplateResponse> CreateTemplateAsync(CreateOnboardingTemplateRequest request)
    {
        var template = new AssessmentTemplate
        {
            TenantId = request.TenantId,
            Name = request.Name,
            Description = request.Description,
            Fields = JsonDocument.Parse(JsonSerializer.Serialize(request.Steps))
        };
        var created = await repository.CreateTemplateAsync(template);
        return MapTemplate(created);
    }

    public async Task<OnboardingStatusResponse?> CompleteAsync(ulong memberId)
    {
        var steps = await repository.GetStepsByMemberAsync(memberId);
        if (steps.Count == 0) return null;
        foreach (var s in steps.Where(s => !s.IsDone)) { s.IsDone = true; s.DoneAt = DateTime.UtcNow; await repository.UpdateStepAsync(s); }
        return BuildStatus(memberId, steps);
    }

    private static OnboardingStatusResponse BuildStatus(ulong memberId, List<OnboardingStep> steps) => new()
    {
        MemberId = memberId,
        TotalSteps = steps.Count,
        CompletedSteps = steps.Count(s => s.IsDone),
        CurrentStep = steps.FirstOrDefault(s => !s.IsDone)?.StepKey ?? "completed",
        IsComplete = steps.All(s => s.IsDone)
    };

    private static OnboardingTemplateResponse MapTemplate(AssessmentTemplate t) => new()
    {
        Id = t.Id,
        TenantId = t.TenantId,
        Name = t.Name,
        Description = t.Description,
        Steps = []
    };
}
