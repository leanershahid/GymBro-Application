namespace GymManagmentApplication.Application.SSO.Responses;

public class SsoInitResponse
{
    public string AuthorizationUrl { get; set; } = default!;
    public string State { get; set; } = default!;
}

public class SsoProviderResponse
{
    public string Id { get; set; } = default!;
    public string Provider { get; set; } = default!;
    public string ClientId { get; set; } = default!;
    public string RedirectUri { get; set; } = default!;
    public bool IsEnabled { get; set; }
}
