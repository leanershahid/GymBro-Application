using GymManagmentApplication.Infrastructure.Http;
using System.Text;
using FluentValidation;
using GymManagmentApplication.Application.Auth;
using GymManagmentApplication.Application.Exercise.Interfaces;
using GymManagmentApplication.Application.Exercise.Services;
using GymManagmentApplication.Application.Exercise.Validators;
using GymManagmentApplication.Application.Workout.Interfaces;
using GymManagmentApplication.Application.Workout.Services;
using GymManagmentApplication.Application.Workout.Validators;
using GymManagmentApplication.Application.WorkoutPlan.Interfaces;
using GymManagmentApplication.Application.WorkoutPlan.Services;
using GymManagmentApplication.Application.WorkoutPlan.Validators;
using GymManagmentApplication.Application.WorkoutBuilder.Interfaces;
using GymManagmentApplication.Application.WorkoutBuilder.Services;
using GymManagmentApplication.Application.WorkoutBuilder.Validators;
using GymManagmentApplication.Application.WorkoutAutomation.Interfaces;
using GymManagmentApplication.Application.WorkoutAutomation.Services;
using GymManagmentApplication.Application.WorkoutAutomation.Validators;
using GymManagmentApplication.Infrastructure.Repositories.Exercise;
using GymManagmentApplication.Infrastructure.Repositories.Workout;
using GymManagmentApplication.Infrastructure.Repositories.WorkoutPlan;
using GymManagmentApplication.Infrastructure.Repositories.WorkoutAutomation;
using GymManagmentApplication.Infrastructure.Repositories;
using GymManagmentApplication.Application.Auth.Interfaces;
using GymManagmentApplication.Application.Auth.Services;
using GymManagmentApplication.Application.Auth.Validators;
using GymManagmentApplication.Application.Biometric.Interfaces;
using GymManagmentApplication.Application.Biometric.Services;
using GymManagmentApplication.Application.Biometric.Validators;
using GymManagmentApplication.Application.Corporate.Interfaces;
using GymManagmentApplication.Application.Corporate.Services;
using GymManagmentApplication.Application.Corporate.Validators;
using GymManagmentApplication.Application.Lead.Interfaces;
using GymManagmentApplication.Application.Lead.Services;
using GymManagmentApplication.Application.Lead.Validators;
using GymManagmentApplication.Application.Member.Interfaces;
using GymManagmentApplication.Application.Member.Services;
using GymManagmentApplication.Application.Member.Validators;
using GymManagmentApplication.Application.Onboarding.Interfaces;
using GymManagmentApplication.Application.Onboarding.Services;
using GymManagmentApplication.Application.Onboarding.Validators;
using GymManagmentApplication.Application.Roles.Interfaces;
using GymManagmentApplication.Application.Roles.Services;
using GymManagmentApplication.Application.Roles.Validators;
using GymManagmentApplication.Application.SSO.Interfaces;
using GymManagmentApplication.Application.SSO.Services;
using GymManagmentApplication.Application.SSO.Validators;
using GymManagmentApplication.Application.Branch.Interfaces;
using GymManagmentApplication.Application.Branch.Services;
using GymManagmentApplication.Application.Branch.Validators;
using GymManagmentApplication.Application.Tenant.Interfaces;
using GymManagmentApplication.Application.Tenant.Services;
using GymManagmentApplication.Application.Tenant.Validators;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Services;
using GymManagmentApplication.Application.Trainer.Validators;
using GymManagmentApplication.Application.Access;
using GymManagmentApplication.Application.Billing.Interfaces;
using GymManagmentApplication.Application.Billing.Services;
using GymManagmentApplication.Application.Billing.Validators;
using GymManagmentApplication.Application.Dashboard.Interfaces;
using GymManagmentApplication.Application.Dashboard.Services;
using GymManagmentApplication.Application.Health.Interfaces;
using GymManagmentApplication.Application.Health.Services;
using GymManagmentApplication.Application.Challenges.Interfaces;
using GymManagmentApplication.Application.Challenges.Services;
using GymManagmentApplication.Application.Challenges.Validators;
using GymManagmentApplication.Application.AiCoach.Interfaces;
using GymManagmentApplication.Application.AiCoach.Services;
using GymManagmentApplication.Infrastructure.Repositories.Branch;
using GymManagmentApplication.Infrastructure.Repositories.Tenant;
using Microsoft.EntityFrameworkCore;
using GymManagmentApplication.Infrastructure.Repositories.Corporate;
using GymManagmentApplication.Infrastructure.Repositories.Lead;
using GymManagmentApplication.Infrastructure.Repositories.Onboarding;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

// Local secrets from .env (git-ignored); real environment variables take priority.
GymManagmentApplication.Infrastructure.DotEnv.Load(Path.Combine(Directory.GetCurrentDirectory(), ".env"));

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Database
// Runtime and design-time (AppDbContextFactory) share AppDbContextOptions.
builder.Services.AddSingleton(_ =>
    GymManagmentApplication.Infrastructure.Data.AppDbContextOptions.BuildDataSource(
        builder.Configuration.GetConnectionString("DefaultConnection")));
// Database:EnableRetryOnFailure (default false): transactions now run through
// UnitOfWork.InTransactionAsync (execution strategy), so it can be turned on after testing.
var enableDbRetry = builder.Configuration.GetValue<bool>("Database:EnableRetryOnFailure");
builder.Services.AddDbContext<AppDbContext>((sp, options) =>
    GymManagmentApplication.Infrastructure.Data.AppDbContextOptions.Configure(
        options, sp.GetRequiredService<Npgsql.NpgsqlDataSource>(), enableDbRetry));
// ARCH-022: Application services depend on IAppDbContext — the same scoped AppDbContext instance.
builder.Services.AddScoped<GymManagmentApplication.Application.Common.IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

// JWT Settings — validated at startup, so a missing/short key fails the deploy instead of the first login.
builder.Services.AddOptions<JwtSettings>()
    .Bind(builder.Configuration.GetSection("Jwt"))
    .Validate(s => !string.IsNullOrWhiteSpace(s.Key) && Encoding.UTF8.GetByteCount(s.Key) >= 32,
        "Jwt:Key (env var Jwt__Key) must be set and at least 32 bytes long.")
    .Validate(s => !string.IsNullOrWhiteSpace(s.Issuer) && !string.IsNullOrWhiteSpace(s.Audience),
        "Jwt:Issuer and Jwt:Audience must be set.")
    .ValidateOnStart();
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();
if (string.IsNullOrWhiteSpace(jwtSettings.Key) || Encoding.UTF8.GetByteCount(jwtSettings.Key) < 32)
    throw new InvalidOperationException("Jwt:Key (env var Jwt__Key) must be set and at least 32 bytes long.");

// Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Ensures short JWT claim names ("sub", "role", ...) are mapped to their
        // long ClaimTypes.* equivalents, which is what controllers/AuthorizeRolesAttribute read.
        options.MapInboundClaims = true;
        options.Events = new JwtBearerEvents
        {
            // Reject tokens of users who were deleted, deactivated, demoted or whose gym closed.
            OnTokenValidated = async ctx =>
            {
                var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var cache = ctx.HttpContext.RequestServices.GetRequiredService<Microsoft.Extensions.Caching.Memory.IMemoryCache>();
                var reason = await GymManagmentApplication.Application.Auth.TokenValidator.GetRejectionReasonAsync(ctx.Principal!, db, cache);
                if (reason is not null) ctx.Fail(reason);
            },
            // 401s from the fallback policy (below) use the app's usual JSON envelope too.
            OnChallenge = async ctx =>
            {
                ctx.HandleResponse();
                ctx.Response.Headers.WWWAuthenticate = "Bearer";
                await ErrorResponse.WriteAsync(ctx.HttpContext, StatusCodes.Status401Unauthorized, "Unauthorized. Token is missing or invalid.");
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

// Secure by default: every endpoint needs a signed-in user unless it is marked [AllowAnonymous]
// (sign-in/registration/refresh/reset/OTP in AuthController, SSO init/callback, /healthz). Role and
// module checks stay in AuthorizeRoles / RequireModule.
builder.Services.AddAuthorization(o =>
    o.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build());
builder.Services.AddMemoryCache();
// Brotli/gzip for JSON responses: far fewer bytes over the (slow, mobile) link to the app.
builder.Services.AddResponseCompression(o => o.EnableForHttps = true);
builder.Services.AddControllers(o =>
    {
        // Runs the FluentValidation validator of every [FromBody]/[FromQuery] model (Validation:Mode).
        o.Filters.Add<GymManagmentApplication.Filters.FluentValidationFilter>();
        // Documents the error envelope for every action in Swagger (success bodies are still ApiResponse<object>).
        foreach (var status in new[] { 400, 401, 403, 404, 409, 500 })
            o.Filters.Add(new Microsoft.AspNetCore.Mvc.ProducesResponseTypeAttribute(typeof(GymManagmentApplication.Middleware.ErrorResponse), status));
    })
    .AddJsonOptions(o =>
    {
        // Blank optional form fields ("") arrive as null instead of failing the request;
        // numbers typed into text inputs ("12") are accepted too.
        o.JsonSerializerOptions.Converters.Add(new GymManagmentApplication.Infrastructure.Json.EmptyStringAsNullConverterFactory());
        // Enums in request bodies by name or number (responses still write numbers).
        o.JsonSerializerOptions.Converters.Add(new GymManagmentApplication.Infrastructure.Json.FlexibleEnumConverterFactory());
        o.JsonSerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString;
    })
    .ConfigureApiBehaviorOptions(o =>
        // Field-level, human-readable 400s in the usual { success, message, errors } shape.
        o.InvalidModelStateResponseFactory = GymManagmentApplication.Infrastructure.Json.ValidationResponses.Create);
builder.Services.AddEndpointsApiExplorer();

// Swagger with Bearer auth support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "Gym Management API", Version = "v1" });
    c.OperationFilter<GymManagmentApplication.Filters.SwaggerConventionsFilter>();
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Enter: Bearer {token}",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            []
        }
    });
});
// CORS: only the configured web front-ends (Cors:AllowedOrigins / Cors__AllowedOrigins__0 …).
// Native apps send no Origin header, so they are unaffected.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy => policy
        .SetIsOriginAllowed(origin => allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
            || (builder.Environment.IsDevelopment() && Uri.TryCreate(origin, UriKind.Absolute, out var u) && u.IsLoopback))
        .AllowAnyMethod().AllowAnyHeader()
        .WithExposedHeaders("X-Trace-Id", "api-version"));
});

// Behind Render's proxy: X-Forwarded-For/Proto give the real client IP (rate limits, sessions).
// The app is only reachable through that proxy, so its (internal, changing) address isn't pinned;
// instead ForwardLimit = 1 takes only the LAST X-Forwarded-For entry — the one the proxy appended —
// so anything a client writes into the header itself is ignored. ForwardedHeaders__ForwardLimit
// raises it if another trusted proxy/CDN hop is added; ForwardedHeaders__KnownProxies__0… pins proxies.
builder.Services.Configure<Microsoft.AspNetCore.Builder.ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = builder.Configuration.GetValue("ForwardedHeaders:ForwardLimit", 1);
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
    foreach (var proxy in builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>() ?? [])
        if (System.Net.IPAddress.TryParse(proxy, out var ip)) o.KnownProxies.Add(ip);
});
builder.Services.AddAppRateLimits(builder.Configuration);

// Health: /healthz = liveness (Render's healthCheckPath, no dependencies); /healthz/ready adds the database.
builder.Services.AddHealthChecks()
    .AddCheck<GymManagmentApplication.Infrastructure.Http.DatabaseHealthCheck>("database", tags: ["ready"]);

// Outgoing HTTP (Razorpay, Cloudinary, Supabase, …): no request may hang for the 100 s default.
// Storage gets longer for 100 MB video uploads.
builder.Services.ConfigureHttpClientDefaults(http => http.ConfigureHttpClient(c => c.Timeout = TimeSpan.FromSeconds(30)));
builder.Services.AddHttpClient(GymManagmentApplication.Infrastructure.Storage.FileStorage.HttpClientName,
    c => c.Timeout = TimeSpan.FromMinutes(5));

// File storage — Cloudinary / Supabase Storage when configured, local wwwroot/uploads otherwise.
builder.Services.Configure<GymManagmentApplication.Infrastructure.Storage.StorageSettings>(builder.Configuration.GetSection("Storage"));
builder.Services.AddScoped<GymManagmentApplication.Application.Common.IFileStorage, GymManagmentApplication.Infrastructure.Storage.FileStorage>();

// Email (SMTP) — codes for password reset / email verification, invoices.
builder.Services.Configure<GymManagmentApplication.Infrastructure.Email.EmailSettings>(builder.Configuration.GetSection("Email"));
builder.Services.AddScoped<GymManagmentApplication.Application.Common.IEmailSender, GymManagmentApplication.Infrastructure.Email.SmtpEmailSender>();
// ARCH-046: email outbox (CommunicationLogs rows) drained by a background sender.
builder.Services.AddScoped<GymManagmentApplication.Application.Common.IEmailOutbox, GymManagmentApplication.Infrastructure.Email.EmailOutbox>();
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Email.EmailOutboxProcessor>();
// Push notifications (Expo), notification preferences, class/PT reminders and waitlist offers.
GymManagmentApplication.Infrastructure.Push.PushRegistration.AddPushNotifications(builder.Services, builder.Configuration);
// Validators — every validator lives in this one assembly, so a single scan registers them all.
builder.Services.AddValidatorsFromAssemblyContaining<LoginValidator>();

// Current caller (tenant/branch/role from the JWT)
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<GymManagmentApplication.Application.Common.ICurrentUser, GymManagmentApplication.Application.Common.CurrentUser>();

// Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Auth.TwoFactor.TwoFactorService>(); // 2FA (feature 10)
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IBranchService, BranchService>();
builder.Services.AddScoped<ITrainerService, TrainerService>();
builder.Services.AddScoped<MemberDirectoryService>();
builder.Services.AddScoped<MemberFilesService>();
builder.Services.AddScoped<MemberNotesService>();
builder.Services.AddScoped<MemberTagsService>();
builder.Services.AddScoped<IMemberService, MemberService>();
builder.Services.AddScoped<ILeadService, LeadService>();
builder.Services.AddScoped<IOnboardingService, OnboardingService>();
builder.Services.AddScoped<ICorporateService, CorporateService>();
builder.Services.AddScoped<ISsoService, SsoService>();
builder.Services.AddScoped<IBiometricService, BiometricService>();
builder.Services.AddScoped<IRolesService, RolesService>();
builder.Services.AddScoped<IExerciseService, ExerciseService>();
builder.Services.AddScoped<IWorkoutService, WorkoutService>();
builder.Services.AddScoped<IWorkoutPlanService, WorkoutPlanService>();
builder.Services.AddScoped<IWorkoutBuilderService, WorkoutBuilderService>();
builder.Services.AddScoped<IWorkoutAutomationService, WorkoutAutomationService>();
builder.Services.AddScoped<IAccessService, AccessService>();
GymManagmentApplication.Application.Common.DataServicesRegistration.AddDataServices(builder.Services);
GymManagmentApplication.Application.Common.ApiServicesRegistration.AddApiServices(builder.Services);
// Gym operations: opening hours, service status, announcements (+ the scheduled-announcement sender).
GymManagmentApplication.Application.Operations.OperationsServicesRegistration.AddOperationsServices(builder.Services);
// Facilities: equipment register, problem reports, incident log.
GymManagmentApplication.Application.Facilities.FacilitiesServicesRegistration.AddFacilitiesServices(builder.Services);
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.AnnouncementPublishJob>();
// Shop (members buy, admins run it) — settings, catalog, and cart/orders.
builder.Services.AddScoped<GymManagmentApplication.Application.Shop.Common.IShopSettingsService, GymManagmentApplication.Application.Shop.Common.ShopSettingsService>();
GymManagmentApplication.Application.Shop.Catalog.ShopCatalogRegistration.AddShopCatalog(builder.Services);
GymManagmentApplication.Application.Shop.Orders.ShopOrdersRegistration.AddShopOrders(builder.Services);
GymManagmentApplication.Application.Social.SocialRegistration.AddSocial(builder.Services);
builder.Services.AddScoped<IMembershipPlanService, MembershipPlanService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<IPaymentService>(sp => sp.GetRequiredService<PaymentService>());
builder.Services.AddScoped<BillingCore>();

// Background housekeeping: membership expiry/auto-renewal, overdue invoices, reminders, cleanup.
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.DailyJobs>();
// Privacy: build data exports (every minute), expire them, anonymise accounts past their grace period.
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.PrivacyJobs>();
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.MembershipRequestJob>(); // self-service: apply approved pauses / cancels / plan changes
// Help & feedback: support requests, FAQ, canned replies, class feedback (+ auto-close / overdue digest job).
GymManagmentApplication.Application.Support.SupportServicesRegistration.AddSupportServices(builder.Services);
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.SupportJob>();
// Trainer ↔ member messaging (polling, no job) + the admin safeguarding review.
GymManagmentApplication.Application.Messaging.MessagingServicesRegistration.AddMessagingServices(builder.Services);
// Cancellation & no-show rules: automatic no-shows (when enabled) and "you can book again" notices.
builder.Services.AddHostedService<GymManagmentApplication.Infrastructure.Jobs.BookingRulesJob>();
builder.Services.AddScoped<IMyBillingService, MyBillingService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Scheduling.ClassService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Scheduling.PtService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Workout.WorkoutStructureService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Engagement.Notifier>();
builder.Services.AddScoped<GymManagmentApplication.Application.Challenges.Services.ChallengeParticipationService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Health.Services.ProgressService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Billing.Payments.IRazorpayClient, GymManagmentApplication.Infrastructure.Payments.RazorpayClient>();
builder.Services.AddSingleton<GymManagmentApplication.Application.Common.ISecretProtector, GymManagmentApplication.Infrastructure.Security.SecretProtector>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IPricingService, PricingService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IHealthService, HealthService>();
builder.Services.AddScoped<IChallengesService, ChallengesService>();
builder.Services.AddScoped<IAiCoachSettingsService, AiCoachSettingsService>();
builder.Services.AddScoped<GymManagmentApplication.Application.Attendance.IAttendanceService, GymManagmentApplication.Application.Attendance.AttendanceService>();

// Infrastructure Repositories
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<IBranchRepository, BranchRepository>();
builder.Services.AddScoped<ITrainerRepository, TrainerRepository>();
builder.Services.AddScoped<ILeadRepository, LeadRepository>();
builder.Services.AddScoped<IOnboardingRepository, OnboardingRepository>();
builder.Services.AddScoped<ICorporateRepository, CorporateRepository>();
builder.Services.AddScoped<IExerciseRepository, ExerciseRepository>();
builder.Services.AddScoped<IWorkoutRepository, WorkoutRepository>();
builder.Services.AddScoped<IWorkoutPlanRepository, WorkoutPlanRepository>();
builder.Services.AddScoped<IWorkoutAutomationRepository, WorkoutAutomationRepository>();

var app = builder.Build();

// Fail fast on configuration that would otherwise break later (Secrets:Key is required in Production).
app.Services.GetRequiredService<GymManagmentApplication.Application.Common.ISecretProtector>();

// Apply pending EF Core migrations, then seed default tenant/roles/modules, on startup.
// Database:MigrateOnStartup / Database:SeedOnStartup (both default true — today's behaviour) can be
// turned off once migrations run as a release step (e.g. an EF bundle in Render's pre-deploy command).
// A Postgres advisory lock makes overlapping deploys (old + new instance) take turns instead of
// migrating/seeding concurrently.
var migrateOnStartup = app.Configuration.GetValue("Database:MigrateOnStartup", true);
var seedOnStartup = app.Configuration.GetValue("Database:SeedOnStartup", true);
if (migrateOnStartup || seedOnStartup)
{
    // Advisory lock key 7272026001: "GymBro startup migrations".
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var started = System.Diagnostics.Stopwatch.StartNew();
    await db.Database.OpenConnectionAsync();
    try
    {
        app.Logger.LogInformation("Startup: waiting for the migration lock…");
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_lock(7272026001)");
        try
        {
            if (migrateOnStartup)
            {
                var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
                app.Logger.LogInformation("Startup: {Count} pending migration(s){List}.", pending.Count,
                    pending.Count == 0 ? "" : ": " + string.Join(", ", pending));
                if (pending.Count > 0) await db.Database.MigrateAsync();
            }
            if (seedOnStartup) await DbSeeder.SeedAsync(db);
        }
        finally
        {
            await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock(7272026001)");
        }
        app.Logger.LogInformation("Startup: migrations/seed finished in {Elapsed} ms.", started.ElapsedMilliseconds);
    }
    catch (Exception ex)
    {
        app.Logger.LogCritical(ex, "Startup: database migration/seed failed.");
        throw;
    }
    finally
    {
        await db.Database.CloseConnectionAsync();
    }
}
else
{
    app.Logger.LogInformation("Startup: migrations and seeding are disabled (Database:MigrateOnStartup/SeedOnStartup).");
}

app.UseForwardedHeaders();
app.UseMiddleware<RequestContextMiddleware>();   // trace id, api-version, access log
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseResponseCompression();
app.UseMiddleware<ExceptionMiddleware>();

// API docs only in Development, or when explicitly enabled (Swagger__Enabled=true).
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Swagger:Enabled"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles(); // local uploads (wwwroot/uploads) when Supabase Storage isn't configured
app.UseCors("Frontend");
app.UseAuthentication();
app.UseMiddleware<GymManagmentApplication.Middleware.TwoFactorSetupGate>(); // 2FA setup required → /api/auth/* only
app.UseAuthorization();
app.UseRateLimiter();
app.MapHealthChecks("/healthz", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions { Predicate = _ => false })
    .AllowAnonymous().DisableRateLimiting();
app.MapHealthChecks("/healthz/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") })
    .AllowAnonymous().DisableRateLimiting();
app.MapControllers();

app.Run();
