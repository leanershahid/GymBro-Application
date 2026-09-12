using GymManagmentApplication.Domain.Entities.Platform;

namespace GymManagmentApplication.Infrastructure.Repositories.Onboarding;

public interface IOnboardingRepository
{
    Task<List<OnboardingStep>> GetStepsByMemberAsync(ulong memberId);
    Task<List<OnboardingStep>> CreateStepsAsync(List<OnboardingStep> steps);
    Task<OnboardingStep?> GetStepAsync(ulong memberId, string stepKey);
    Task<OnboardingStep> UpdateStepAsync(OnboardingStep step);
    Task<ClientAssessment> CreateAssessmentAsync(ClientAssessment assessment);
    Task<List<AssessmentTemplate>> GetTemplatesAsync(ulong tenantId);
    Task<AssessmentTemplate> CreateTemplateAsync(AssessmentTemplate template);
}
