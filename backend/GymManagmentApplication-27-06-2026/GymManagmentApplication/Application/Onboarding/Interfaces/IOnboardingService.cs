using GymManagmentApplication.Application.Onboarding.Requests;
using GymManagmentApplication.Application.Onboarding.Responses;

namespace GymManagmentApplication.Application.Onboarding.Interfaces;

public interface IOnboardingService
{
    Task<OnboardingStatusResponse> StartAsync(StartOnboardingRequest request);
    Task<OnboardingStatusResponse?> GetStatusAsync(ulong memberId);
    Task<OnboardingStatusResponse?> SubmitStepAsync(ulong memberId, SubmitOnboardingStepRequest request);
    Task<AssessmentResponse> SubmitAssessmentAsync(SubmitAssessmentRequest request);
    Task<List<OnboardingTemplateResponse>> GetTemplatesAsync(ulong tenantId);
    Task<OnboardingTemplateResponse> CreateTemplateAsync(CreateOnboardingTemplateRequest request);
    Task<OnboardingStatusResponse?> CompleteAsync(ulong memberId);
}
