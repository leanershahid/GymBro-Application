using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Onboarding.Interfaces;
using GymManagmentApplication.Application.Onboarding.Requests;
using GymManagmentApplication.Application.Onboarding.Responses;
using GymManagmentApplication.Domain.Constants;
using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Infrastructure.Repositories.Onboarding;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Onboarding.Services;

public class OnboardingService(IOnboardingRepository repository, ICurrentUser currentUser, AppDbContext db) : IOnboardingService
{
    private static readonly string[] DefaultSteps = ["profile", "goals", "health", "payment", "agreement"];

    /// <summary>Member must exist in the caller's gym; a client may only act on themselves.</summary>
    private async Task<Domain.Entities.Identity.User> GetMemberAsync(ulong memberId) =>
        // Clients: themselves; trainers: assigned clients; admins/staff: anyone in their gym.
        await db.GetActionableUserAsync(currentUser, memberId)
        ?? throw new KeyNotFoundException($"Member {memberId} not found.");

    public async Task<OnboardingStatusResponse> StartAsync(StartOnboardingRequest request)
    {
        var member = await GetMemberAsync(request.MemberId);
        var existing = await repository.GetStepsByMemberAsync(member.Id);
        if (existing.Count > 0) return BuildStatus(member.Id, existing);

        var steps = DefaultSteps.Select((key, i) => new OnboardingStep
        {
            TenantId = member.TenantId,
            UserId = member.Id,
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
        await GetMemberAsync(memberId);
        var steps = await repository.GetStepsByMemberAsync(memberId);
        return steps.Count == 0 ? null : BuildStatus(memberId, steps);
    }

    public async Task<OnboardingStatusResponse?> SubmitStepAsync(ulong memberId, SubmitOnboardingStepRequest request)
    {
        await GetMemberAsync(memberId);
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
        var member = await GetMemberAsync(request.MemberId);
        if (!await db.AssessmentTemplates.AnyAsync(t => t.Id == request.TemplateId))
            throw new KeyNotFoundException($"Assessment template {request.TemplateId} not found.");
        var assessment = new ClientAssessment
        {
            TenantId = member.TenantId,
            ClientId = member.Id,
            TemplateId = request.TemplateId,
            Responses = JsonDocument.Parse(JsonSerializer.Serialize(request.Responses)),
            Notes = request.Notes
        };
        var created = await repository.CreateAssessmentAsync(assessment);
        return new AssessmentResponse { Id = created.Id, MemberId = created.ClientId, TemplateId = created.TemplateId, Score = created.Score, Notes = created.Notes, AssessedAt = created.AssessedAt };
    }

    public async Task<List<OnboardingTemplateResponse>> GetTemplatesAsync(ulong tenantId)
    {
        var templates = await repository.GetTemplatesAsync(currentUser.ResolveTenantId(tenantId));
        return templates.Select(MapTemplate).ToList();
    }

    public async Task<OnboardingTemplateResponse> CreateTemplateAsync(CreateOnboardingTemplateRequest request)
    {
        var template = new AssessmentTemplate
        {
            TenantId = currentUser.ResolveTenantId(request.TenantId),
            Name = request.Name,
            Description = request.Description,
            Fields = JsonDocument.Parse(JsonSerializer.Serialize(request.Steps))
        };
        var created = await repository.CreateTemplateAsync(template);
        return MapTemplate(created);
    }

    public async Task<OnboardingStatusResponse?> CompleteAsync(ulong memberId)
    {
        await GetMemberAsync(memberId);
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
