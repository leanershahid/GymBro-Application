using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace GymManagmentApplication.Infrastructure.Data;

/// <summary>
/// Design-time factory for `dotnet ef`. Configures the provider exactly like the running app
/// (<see cref="AppDbContextOptions"/>, ARCH-090). No connection string lives in source: it comes
/// from the git-ignored appsettings.Development.json, user secrets or the
/// ConnectionStrings__DefaultConnection environment variable. `migrations add` / `migrations script`
/// never open a connection, so they also work without one.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddUserSecrets<AppDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        AppDbContextOptions.Configure(
            optionsBuilder,
            AppDbContextOptions.BuildDataSource(config.GetConnectionString("DefaultConnection")),
            config.GetValue<bool>("Database:EnableRetryOnFailure"));

        return new AppDbContext(optionsBuilder.Options);
    }
}
