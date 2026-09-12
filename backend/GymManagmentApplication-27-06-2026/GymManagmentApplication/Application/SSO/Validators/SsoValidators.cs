using FluentValidation;
using GymManagmentApplication.Application.SSO.Requests;

namespace GymManagmentApplication.Application.SSO.Validators;

public class SsoInitValidator : AbstractValidator<SsoInitRequest>
{
    private static readonly string[] _supported = ["Google", "Microsoft", "Apple"];
    public SsoInitValidator()
    {
        RuleFor(x => x.Provider).NotEmpty().Must(p => _supported.Contains(p, StringComparer.OrdinalIgnoreCase))
            .WithMessage("Provider must be Google, Microsoft, or Apple.");
        RuleFor(x => x.RedirectUri).NotEmpty();
    }
}

public class SsoCallbackValidator : AbstractValidator<SsoCallbackRequest>
{
    public SsoCallbackValidator()
    {
        RuleFor(x => x.Provider).NotEmpty();
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.State).NotEmpty();
    }
}

public class ConfigureSsoProviderValidator : AbstractValidator<ConfigureSsoProviderRequest>
{
    public ConfigureSsoProviderValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.ClientSecret).NotEmpty();
        RuleFor(x => x.RedirectUri).NotEmpty();
    }
}
