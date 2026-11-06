using GymManagmentApplication.Domain.Entities.Platform;

namespace GymManagmentApplication.Application.Onboarding.Interfaces;

public interface IOnboardingRepository
{
    Task<List<OnboardingStep>> GetStepsByMemberAsync(ulong memberId);
    Task<List<OnboardingStep>> CreateStepsAsync(List<OnboardingStep> steps);
    Task<OnboardingStep?> GetStepAsync(ulong memberId, string stepKey);
    Task<OnboardingStep> UpdateStepAsync(OnboardingStep step);
    /// <summary>Saves several steps with one SaveChanges.</summary>
    Task UpdateStepsAsync(IEnumerable<OnboardingStep> steps);
    Task<ClientAssessment> CreateAssessmentAsync(ClientAssessment assessment);
    Task<List<AssessmentTemplate>> GetTemplatesAsync(ulong tenantId);
    Task<AssessmentTemplate> CreateTemplateAsync(AssessmentTemplate template);
}
