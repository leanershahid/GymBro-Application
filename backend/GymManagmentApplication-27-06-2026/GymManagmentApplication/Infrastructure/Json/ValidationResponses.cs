using System.Text.RegularExpressions;
using GymManagmentApplication.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace GymManagmentApplication.Infrastructure.Json;

/// <summary>
/// Turns ASP.NET's automatic 400 (model binding / JSON errors) into the app's usual
/// <see cref="ApiResponse{T}"/> with readable, per-field messages, e.g.
/// "Employment › Joining date: 'abc' is not a valid date. Use YYYY-MM-DD."
/// instead of "The JSON value could not be converted to System.Nullable`1[System.DateOnly]".
/// </summary>
public static partial class ValidationResponses
{
    public static IActionResult Create(ActionContext context)
    {
        var errors = context.ModelState
            .Where(kv => kv.Value is { Errors.Count: > 0 })
            .SelectMany(kv => kv.Value!.Errors.Select(e => $"{FieldLabel(kv.Key)}: {Message(e.ErrorMessage, e.Exception)}"))
            .Distinct()
            .ToList();

        return new BadRequestObjectResult(ApiResponse<object>.Fail("Please check the highlighted fields.", errors));
    }

    private static string Message(string message, Exception? ex)
    {
        var text = string.IsNullOrWhiteSpace(message) ? ex?.Message ?? "Invalid value." : message;
        if (text.Contains("is not a valid date")) return text[..(text.IndexOf("Use YYYY-MM-DD.", StringComparison.Ordinal) + 15)];
        if (text.StartsWith("Choose one of:", StringComparison.Ordinal)) return text;
        if (text.Contains("could not be converted"))
        {
            if (text.Contains("DateOnly") || text.Contains("DateTime")) return "Enter a valid date (YYYY-MM-DD).";
            if (Regex.IsMatch(text, "Int|Decimal|Double|Byte|UInt|Single")) return "Enter a number.";
            if (text.Contains("Boolean")) return "Choose yes or no.";
            return "Invalid value.";
        }
        // "The Email field is required." → "is required"
        var m = RequiredRegex().Match(text);
        return m.Success ? "This field is required." : text;
    }

    /// <summary>"$.employment.joiningDate" / "request.Employment.JoiningDate" → "Employment › Joining date".</summary>
    private static string FieldLabel(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key == "$" || key.Equals("request", StringComparison.OrdinalIgnoreCase))
            return "Request";
        var parts = key.TrimStart('$', '.').Split('.', StringSplitOptions.RemoveEmptyEntries)
            .Where(p => !p.Equals("request", StringComparison.OrdinalIgnoreCase))
            .Select(p => Humanize(IndexRegex().Replace(p, m => $" #{int.Parse(m.Groups[1].Value) + 1}")));
        return string.Join(" › ", parts);
    }

    private static string Humanize(string name)
    {
        var spaced = CamelRegex().Replace(name, " $1").Trim();
        return spaced.Length == 0 ? name : char.ToUpper(spaced[0]) + spaced[1..].ToLower();
    }

    [GeneratedRegex(@"^The .+ field is required\.?$")] private static partial Regex RequiredRegex();
    [GeneratedRegex(@"\[(\d+)\]")] private static partial Regex IndexRegex();
    [GeneratedRegex(@"(?<=[a-z0-9])([A-Z])")] private static partial Regex CamelRegex();
}
