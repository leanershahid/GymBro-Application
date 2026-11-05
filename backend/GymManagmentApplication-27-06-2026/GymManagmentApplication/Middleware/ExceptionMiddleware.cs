using GymManagmentApplication.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Middleware;

/// <summary>
/// Maps exceptions thrown by services to status codes in the usual error envelope (plus a traceId):
/// <list type="bullet">
/// <item><see cref="UnauthorizedAccessException"/> → 403, or 401 when the message asks the user to sign in again.</item>
/// <item><see cref="KeyNotFoundException"/> → 404; <see cref="ArgumentException"/> → 400 (services throw these with
/// user-facing messages; framework-generated argument messages, e.g. "Value cannot be null. (Parameter 'x')", are hidden).</item>
/// <item><see cref="DbUpdateConcurrencyException"/>, FK and unique violations → 409.</item>
/// <item><see cref="HttpRequestException"/>/timeouts talking to an external service → 502/504.</item>
/// <item>Anything else → 500 with a generic message; details only in Development, never the raw exception text.</item>
/// </list>
/// </summary>
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (context.Response.HasStarted)
        {
            // Too late to write an error body; just make sure it is logged.
            logger.LogError(ex, "Unhandled exception after the response started.");
            throw;
        }
        catch (UnauthorizedAccessException ex)
        {
            // "Please sign in again" problems are authentication (401, the app refreshes or signs out);
            // everything else is a forbidden action (403).
            var reauth = ex.Message.Contains("sign in again", StringComparison.OrdinalIgnoreCase);
            await ErrorResponse.WriteAsync(context, reauth ? StatusCodes.Status401Unauthorized : StatusCodes.Status403Forbidden, ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            await ErrorResponse.WriteAsync(context, StatusCodes.Status404NotFound, Clean(ex, "The requested record was not found."));
        }
        catch (ArgumentException ex)
        {
            await ErrorResponse.WriteAsync(context, StatusCodes.Status400BadRequest, Clean(ex, "The request is not valid."));
        }
        catch (DbUpdateConcurrencyException ex)
        {
            logger.LogWarning(ex, "Concurrency conflict.");
            await ErrorResponse.WriteAsync(context, StatusCodes.Status409Conflict,
                "This record was changed by someone else. Reload it and try again.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23503" })
        {
            // Foreign-key violation, e.g. deleting a branch that still has members.
            logger.LogWarning(ex, "Foreign key violation.");
            await ErrorResponse.WriteAsync(context, StatusCodes.Status409Conflict,
                "This record is still referenced by other data and cannot be changed or deleted.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg)
        {
            // Unique violation: a duplicate value, or (PK_) two saves picked the same new id at once.
            logger.LogWarning(ex, "Unique constraint {Constraint} violated.", pg.ConstraintName);
            var primaryKey = pg.ConstraintName?.StartsWith("PK_", StringComparison.Ordinal) == true;
            await ErrorResponse.WriteAsync(context, StatusCodes.Status409Conflict, primaryKey
                ? "Another change was saved at the same moment. Please try again."
                : pg.ConstraintName?.Contains("Email", StringComparison.OrdinalIgnoreCase) == true
                    ? "That email address is already in use."
                    : "A record with the same value already exists.");
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "External service call failed.");
            await ErrorResponse.WriteAsync(context, StatusCodes.Status502BadGateway,
                "A service we depend on didn't respond correctly. Please try again in a moment.");
        }
        catch (TaskCanceledException ex) when (!context.RequestAborted.IsCancellationRequested)
        {
            // HttpClient timeouts surface as TaskCanceledException.
            logger.LogError(ex, "External service call timed out.");
            await ErrorResponse.WriteAsync(context, StatusCodes.Status504GatewayTimeout,
                "A service we depend on took too long to answer. Please try again in a moment.");
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client went away; nothing to send.
            logger.LogInformation("Request aborted by the client.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception occurred.");
            List<string>? errors = null;
            if (env.IsDevelopment())
            {
                errors = [ex.GetType().Name + ": " + ex.Message];
                if (ex.InnerException is not null) errors.Add(ex.InnerException.Message);
            }
            await ErrorResponse.WriteAsync(context, StatusCodes.Status500InternalServerError,
                "An unexpected error occurred. If it keeps happening, contact support with the trace id.", errors);
        }
    }

    /// <summary>
    /// Service messages are written for users; messages generated by the framework (they name a
    /// parameter, e.g. "Value cannot be null. (Parameter 'source')") are replaced by <paramref name="fallback"/>.
    /// </summary>
    private string Clean(Exception ex, string fallback)
    {
        var message = ex.Message;
        var frameworkMessage = ex is ArgumentException { ParamName: not null } ||
                               message.Contains("(Parameter '", StringComparison.Ordinal) ||
                               message.StartsWith("The given key", StringComparison.Ordinal);
        if (!frameworkMessage) return message;
        logger.LogWarning(ex, "Framework exception mapped to a client error.");
        return fallback;
    }
}
