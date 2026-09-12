using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Responses;
using GymManagmentApplication.Application.SSO.Interfaces;
using GymManagmentApplication.Application.SSO.Requests;
using GymManagmentApplication.Application.SSO.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.SSO.Services;

public class SsoService(AppDbContext db, IAuthService authService) : ISsoService
{
    public Task<SsoInitResponse> InitAsync(SsoInitRequest request)
    {
        var state = Guid.NewGuid().ToString("N");
        var url = request.Provider.ToLower() switch
        {
            "google"    => $"https://accounts.google.com/o/oauth2/auth?state={state}&redirect_uri={Uri.EscapeDataString(request.RedirectUri)}",
            "microsoft" => $"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state={state}&redirect_uri={Uri.EscapeDataString(request.RedirectUri)}",
            "apple"     => $"https://appleid.apple.com/auth/authorize?state={state}&redirect_uri={Uri.EscapeDataString(request.RedirectUri)}",
            _           => throw new ArgumentException($"Unsupported provider: {request.Provider}")
        };
        return Task.FromResult(new SsoInitResponse { AuthorizationUrl = url, State = state });
    }

    public async Task<AuthResponse?> CallbackAsync(SsoCallbackRequest request)
    {
        var mockEmail = $"sso_{request.Code[..6]}@{request.Provider.ToLower()}.example.com";

        var authResult = await authService.RegisterAsync(new RegisterRequest
        {
            Email = mockEmail, Password = Guid.NewGuid().ToString("N"),
            FirstName = "SSO", LastName = request.Provider
        });

        if (authResult is null)
            authResult = await authService.LoginAsync(new LoginRequest { Email = mockEmail, Password = string.Empty });

        return authResult;
    }

    public async Task<List<SsoProviderResponse>> GetProvidersAsync(ulong tenantId)
    {
        var providers = await db.SsoProviders
            .Where(p => p.TenantId == tenantId && p.IsActive)
            .ToListAsync();

        return [.. providers.Select(p => new SsoProviderResponse
        {
            Id = p.Id.ToString(), Provider = p.Provider,
            ClientId = p.ClientId, RedirectUri = string.Empty,
            IsEnabled = p.IsActive
        })];
    }

    public async Task<SsoProviderResponse?> ConfigureProviderAsync(string id, ConfigureSsoProviderRequest request)
    {
        // Try to find existing by provider name in first tenant (simplified)
        SsoProvider? provider;
        if (ulong.TryParse(id, out var pid))
            provider = await db.SsoProviders.FindAsync(pid);
        else
            provider = await db.SsoProviders.FirstOrDefaultAsync(p => p.Provider.ToLower() == id.ToLower());

        if (provider is null)
        {
            var maxId = await db.SsoProviders.MaxAsync(p => (ulong?)p.Id) ?? 0;
            var tenantId = await db.Tenants.OrderBy(t => t.Id).Select(t => t.Id).FirstOrDefaultAsync();
            provider = new SsoProvider
            {
                Id = maxId + 1, TenantId = tenantId, Provider = id,
                ClientId = request.ClientId,
                ClientSecretEnc = request.ClientSecret,
                IsActive = request.IsEnabled
            };
            db.SsoProviders.Add(provider);
        }
        else
        {
            provider.ClientId       = request.ClientId;
            provider.ClientSecretEnc = request.ClientSecret;
            provider.IsActive       = request.IsEnabled;
        }

        await db.SaveChangesAsync();
        return new SsoProviderResponse
        {
            Id = provider.Id.ToString(), Provider = provider.Provider,
            ClientId = provider.ClientId, RedirectUri = request.RedirectUri,
            IsEnabled = provider.IsActive
        };
    }

    public async Task<bool> DeleteProviderAsync(string id)
    {
        SsoProvider? provider;
        if (ulong.TryParse(id, out var pid))
            provider = await db.SsoProviders.FindAsync(pid);
        else
            provider = await db.SsoProviders.FirstOrDefaultAsync(p => p.Provider.ToLower() == id.ToLower());

        if (provider is null) return false;
        db.SsoProviders.Remove(provider);
        await db.SaveChangesAsync();
        return true;
    }
}
