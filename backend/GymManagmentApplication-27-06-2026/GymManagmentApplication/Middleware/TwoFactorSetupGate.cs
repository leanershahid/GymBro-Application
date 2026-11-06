using GymManagmentApplication.Application.Auth.TwoFactor;

namespace GymManagmentApplication.Middleware;

/// <summary>
/// Two-step sign-in policy (feature 10): an access token issued after a user's grace period ran out
/// without 2FA set up carries the <c>tfa_setup</c> claim. Such a token may only call /api/auth/*
/// (me, logout, refresh, 2fa/setup, 2fa/enable…); everything else gets 403 with the error code
/// <c>two_factor_setup_required</c>. Once setup is done, a refresh issues a token without the claim.
/// Runs after UseAuthentication.
/// </summary>
public class TwoFactorSetupGate(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user.Identity?.IsAuthenticated == true
            && user.HasClaim(TwoFactorClaims.SetupRequired, TwoFactorClaims.SetupRequiredValue)
            && !context.Request.Path.StartsWithSegments("/api/auth", StringComparison.OrdinalIgnoreCase)
            && !HttpMethods.IsOptions(context.Request.Method))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return context.Response.WriteAsJsonAsync(Application.Common.ApiResponse<object>.Fail(
                "Your gym requires two-step sign-in. Set it up to continue.", [TwoFactorClaims.SetupRequiredError]));
        }
        return next(context);
    }
}
