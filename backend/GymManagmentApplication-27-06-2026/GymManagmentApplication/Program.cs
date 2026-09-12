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
using GymManagmentApplication.Application.ModuleAccess.Interfaces;
using GymManagmentApplication.Application.ModuleAccess.Services;
using GymManagmentApplication.Application.ModuleAccess.Validators;
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
using GymManagmentApplication.Application.UserModules.Interfaces;
using GymManagmentApplication.Application.UserModules.Services;
using GymManagmentApplication.Application.AiCoach.Interfaces;
using GymManagmentApplication.Application.AiCoach.Services;
using GymManagmentApplication.Infrastructure.Repositories.Branch;
using GymManagmentApplication.Infrastructure.Repositories.Tenant;
using Microsoft.EntityFrameworkCore;
using GymManagmentApplication.Infrastructure.Repositories.Corporate;
using GymManagmentApplication.Infrastructure.Repositories.Lead;
using GymManagmentApplication.Infrastructure.Repositories.Member;
using GymManagmentApplication.Infrastructure.Repositories.Onboarding;
using GymManagmentApplication.Infrastructure.Data;
using GymManagmentApplication.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// JWT Settings
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;

// Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Ensures short JWT claim names ("sub", "role", ...) are mapped to their
        // long ClaimTypes.* equivalents, which is what controllers/AuthorizeRolesAttribute read.
        options.MapInboundClaims = true;
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

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Swagger with Bearer auth support
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "Gym Management API", Version = "v1" });
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
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
// Validators
builder.Services.AddValidatorsFromAssemblyContaining<LoginValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateTenantValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateBranchValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateTrainerValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateMemberValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateLeadValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<StartOnboardingValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateCorporateAccountValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<SsoInitValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<EnrollFaceValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateRoleValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateExerciseValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateWorkoutValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreatePlanValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateAutomationRuleValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<SetModuleAccessValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateMembershipPlanValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<AddCircuitValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<CreateChallengeValidator>();

// Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IBranchService, BranchService>();
builder.Services.AddScoped<ITrainerService, TrainerService>();
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
builder.Services.AddScoped<IModuleAccessService, ModuleAccessService>();
builder.Services.AddScoped<IMembershipPlanService, MembershipPlanService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IInvoiceService, InvoiceService>();
builder.Services.AddScoped<IPricingService, PricingService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IHealthService, HealthService>();
builder.Services.AddScoped<IChallengesService, ChallengesService>();
builder.Services.AddScoped<IUserModulesService, UserModulesService>();
builder.Services.AddScoped<IAiCoachSettingsService, AiCoachSettingsService>();

// Infrastructure Repositories
builder.Services.AddScoped<ITenantRepository, TenantRepository>();
builder.Services.AddScoped<IBranchRepository, BranchRepository>();
builder.Services.AddScoped<ITrainerRepository, TrainerRepository>();
builder.Services.AddScoped<IMemberRepository, MemberRepository>();
builder.Services.AddScoped<ILeadRepository, LeadRepository>();
builder.Services.AddScoped<IOnboardingRepository, OnboardingRepository>();
builder.Services.AddScoped<ICorporateRepository, CorporateRepository>();
builder.Services.AddScoped<IExerciseRepository, ExerciseRepository>();
builder.Services.AddScoped<IWorkoutRepository, WorkoutRepository>();
builder.Services.AddScoped<IWorkoutPlanRepository, WorkoutPlanRepository>();
builder.Services.AddScoped<IWorkoutAutomationRepository, WorkoutAutomationRepository>();

var app = builder.Build();

// Apply any pending EF Core migrations, then seed default Tenant + Roles, on startup.
// Migrations are additive/idempotent (tracked via __EFMigrationsHistory), so this is
// safe to run on every boot - it's what actually gets new tables like Modules/
// UserModuleAccesses created on the deployed database, since nothing else does.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

app.UseMiddleware<ExceptionMiddleware>();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
