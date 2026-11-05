namespace GymManagmentApplication.Middleware;

/// <summary>
/// Security headers for every API response. The API only serves JSON (and, locally, uploaded
/// files), so the policy is strict: nothing may frame it, run scripts from it or sniff types.
/// The web app's own headers (CSP for the Expo bundle, Razorpay, Cloudinary) live in vercel.json.
/// Swagger UI (Development / Swagger:Enabled only) needs inline scripts, so its paths get no CSP.
/// HSTS is added outside Development (Render terminates TLS in front of the app).
/// </summary>
public class SecurityHeadersMiddleware(RequestDelegate next, IHostEnvironment env)
{
    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
        if (!context.Request.Path.StartsWithSegments("/swagger"))
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
        if (!env.IsDevelopment())
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        return next(context);
    }
}
