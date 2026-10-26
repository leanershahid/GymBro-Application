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
