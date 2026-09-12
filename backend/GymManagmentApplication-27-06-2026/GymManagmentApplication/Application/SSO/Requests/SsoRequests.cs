namespace GymManagmentApplication.Application.SSO.Requests;

public class SsoInitRequest
{
    public string Provider { get; set; } = default!; // Google, Microsoft, Apple
    public string RedirectUri { get; set; } = default!;
}

public class SsoCallbackRequest
{
    public string Provider { get; set; } = default!;
    public string Code { get; set; } = default!;
    public string State { get; set; } = default!;
}

public class ConfigureSsoProviderRequest
{
    public string ClientId { get; set; } = default!;
    public string ClientSecret { get; set; } = default!;
    public string RedirectUri { get; set; } = default!;
    public bool IsEnabled { get; set; } = true;
}
