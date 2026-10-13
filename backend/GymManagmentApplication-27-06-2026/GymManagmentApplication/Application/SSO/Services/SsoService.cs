using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Requests;
using GymManagmentApplication.Application.Auth.Responses;
using GymManagmentApplication.Application.SSO.Interfaces;
using GymManagmentApplication.Application.SSO.Requests;
using GymManagmentApplication.Application.SSO.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Application.SSO.Services;

public class SsoService(AppDbContext db, IAuthService authService, ICurrentUser currentUser) : ISsoService
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

    public Task<AuthResponse?> CallbackAsync(SsoCallbackRequest request) =>
        // The previous mock never verified the provider code, so it created/signed in an account
        // for anyone who called it. Closed until a real OAuth token exchange is implemented.
        throw new ArgumentException("SSO sign-in is not configured for this platform yet.");

    public async Task<List<SsoProviderResponse>> GetProvidersAsync(ulong tenantId)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
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
        // Existing provider (by id or name) within the caller's gym — queries are tenant-filtered.
        var tenantId = currentUser.ResolveTenantId();
        SsoProvider? provider;
        if (ulong.TryParse(id, out var pid))
            provider = await db.SsoProviders.FirstOrDefaultAsync(p => p.Id == pid && p.TenantId == tenantId);
        else
            provider = await db.SsoProviders.FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Provider.ToLower() == id.ToLower());

        if (provider is null)
        {
            provider = new SsoProvider
            {
                TenantId = tenantId, Provider = id,
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
