using System.Text.Json;
using GymManagmentApplication.Application.Common;

namespace GymManagmentApplication.Middleware;

/// <summary>
/// The usual <see cref="ApiResponse{T}"/> error envelope plus the request's trace id, so a user
/// can quote it and the matching server log line can be found. Written by middleware (outside MVC),
/// so it is serialized here with the same camelCase rules MVC uses.
/// </summary>
public sealed class ErrorResponse : ApiResponse<object>
{
    public string? TraceId { get; set; }

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static ErrorResponse Create(HttpContext context, string message, List<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors, TraceId = context.TraceIdentifier };

    public static Task WriteAsync(HttpContext context, int status, string message, List<string>? errors = null)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(JsonSerializer.Serialize(Create(context, message, errors), Json));
    }
}
