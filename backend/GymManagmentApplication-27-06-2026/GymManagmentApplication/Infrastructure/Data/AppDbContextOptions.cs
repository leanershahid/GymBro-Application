using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GymManagmentApplication.Infrastructure.Data;

/// <summary>
/// The one place the Npgsql provider is configured, shared by the running app (Program.cs) and the
/// design-time factory used by `dotnet ef`, so migrations are generated against the same model
/// configuration (ARCH-090).
/// </summary>
public static class AppDbContextOptions
{
    /// <summary>Dynamic JSON lets jsonb columns map to Dictionary&lt;,&gt; properties (e.g. ShopProduct.Specifications).</summary>
    public static NpgsqlDataSource BuildDataSource(string? connectionString) =>
        new NpgsqlDataSourceBuilder(connectionString).EnableDynamicJson().Build();

    /// <summary>
    /// Database:EnableRetryOnFailure (default false) turns on Npgsql's retrying execution strategy for
    /// transient errors; off by default because services open explicit transactions outside
    /// CreateExecutionStrategy().ExecuteAsync, which a retrying strategy rejects.
    /// </summary>
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, NpgsqlDataSource dataSource, bool enableRetryOnFailure) =>
        options.UseNpgsql(dataSource, npgsql =>
        {
            if (enableRetryOnFailure) npgsql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
        });
}
