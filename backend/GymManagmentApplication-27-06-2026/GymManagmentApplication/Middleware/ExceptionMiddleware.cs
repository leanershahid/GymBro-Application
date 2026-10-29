using System.Net;
using System.Text.Json;
using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Middleware;

public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (UnauthorizedAccessException ex)
        {
            await WriteAsync(context, HttpStatusCode.Forbidden, ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            await WriteAsync(context, HttpStatusCode.NotFound, ex.Message);
        }
        catch (ArgumentException ex)
        {
            await WriteAsync(context, HttpStatusCode.BadRequest, ex.Message);
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            when (ex.InnerException is Npgsql.PostgresException { SqlState: "23503" })
        {
            // Foreign-key violation, e.g. deleting a branch that still has members.
            logger.LogWarning(ex, "Foreign key violation.");
            await WriteAsync(context, HttpStatusCode.Conflict,
                "This record is still referenced by other data and cannot be changed or deleted.");
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg)
        {
            // Unique violation: a duplicate value, or (PK_) two saves picked the same new id at once.
            logger.LogWarning(ex, "Unique constraint {Constraint} violated.", pg.ConstraintName);
            var primaryKey = pg.ConstraintName?.StartsWith("PK_", StringComparison.Ordinal) == true;
            await WriteAsync(context, HttpStatusCode.Conflict, primaryKey
                ? "Another change was saved at the same moment. Please try again."
                : pg.ConstraintName?.Contains("Email", StringComparison.OrdinalIgnoreCase) == true
                    ? "That email address is already in use."
                    : "A record with the same value already exists.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception occurred.");
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";

            List<string>? errors = null;
            if (env.IsDevelopment())
            {
                errors = new List<string> { ex.Message };
                if (ex.InnerException is not null) errors.Add(ex.InnerException.Message);
            }
            var response = ApiResponse<object>.Fail("An unexpected error occurred.", errors);
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }

    private static Task WriteAsync(HttpContext context, HttpStatusCode status, string message)
    {
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(ApiResponse<object>.Fail(message)));
    }
}
