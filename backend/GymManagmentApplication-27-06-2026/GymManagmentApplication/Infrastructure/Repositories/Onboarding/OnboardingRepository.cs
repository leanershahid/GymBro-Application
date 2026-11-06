using GymManagmentApplication.Domain.Entities.Platform;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

using GymManagmentApplication.Application.Onboarding.Interfaces;

namespace GymManagmentApplication.Infrastructure.Repositories.Onboarding;

public class OnboardingRepository(AppDbContext db) : IOnboardingRepository
{
    public async Task<List<OnboardingStep>> GetStepsByMemberAsync(ulong memberId) =>
        await db.OnboardingSteps
            .Where(s => s.UserId == memberId)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();

    public async Task<List<OnboardingStep>> CreateStepsAsync(List<OnboardingStep> steps)
    {
        db.OnboardingSteps.AddRange(steps);
        await db.SaveChangesAsync();
        return steps;
    }

    public async Task<OnboardingStep?> GetStepAsync(ulong memberId, string stepKey) =>
        await db.OnboardingSteps
            .FirstOrDefaultAsync(s => s.UserId == memberId && s.StepKey == stepKey);

    public async Task UpdateStepsAsync(IEnumerable<OnboardingStep> steps)
    {
        db.OnboardingSteps.UpdateRange(steps);
        await db.SaveChangesAsync();
    }

    public async Task<OnboardingStep> UpdateStepAsync(OnboardingStep step)
    {
        db.OnboardingSteps.Update(step);
        await db.SaveChangesAsync();
        return step;
    }

    public async Task<ClientAssessment> CreateAssessmentAsync(ClientAssessment assessment)
    {
        assessment.AssessedAt = DateTime.UtcNow;
        db.ClientAssessments.Add(assessment);
        await db.SaveChangesAsync();
        return assessment;
    }

    public async Task<List<AssessmentTemplate>> GetTemplatesAsync(ulong tenantId) =>
        await db.AssessmentTemplates
            .Where(t => t.TenantId == tenantId && t.IsActive)
            .OrderBy(t => t.Name)
            .ToListAsync();

    public async Task<AssessmentTemplate> CreateTemplateAsync(AssessmentTemplate template)
    {
        template.CreatedAt = DateTime.UtcNow;
        db.AssessmentTemplates.Add(template);
        await db.SaveChangesAsync();
        return template;
    }
}
