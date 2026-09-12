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
}
