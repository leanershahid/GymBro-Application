using GymManagmentApplication.Application.Auth.Responses;
using GymManagmentApplication.Application.SSO.Requests;
using GymManagmentApplication.Application.SSO.Responses;

namespace GymManagmentApplication.Application.SSO.Interfaces;

public interface ISsoService
{
    Task<SsoInitResponse> InitAsync(SsoInitRequest request);
    Task<AuthResponse?> CallbackAsync(SsoCallbackRequest request);
    Task<List<SsoProviderResponse>> GetProvidersAsync(ulong tenantId);
    Task<SsoProviderResponse?> ConfigureProviderAsync(string id, ConfigureSsoProviderRequest request);
    Task<bool> DeleteProviderAsync(string id);
}
