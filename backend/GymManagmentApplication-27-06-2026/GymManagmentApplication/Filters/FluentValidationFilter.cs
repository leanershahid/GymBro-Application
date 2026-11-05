using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Filters;

/// <summary>
/// Runs the registered FluentValidation validator (if any) for every action argument that comes
/// from the body, query or form, before the action executes. Failures are added to ModelState and
/// answered by the same factory as model-binding errors
/// (<see cref="Infrastructure.Json.ValidationResponses"/>): 400 { success: false,
/// message: "Please check the highlighted fields.", errors: ["Field: message", …] } — so every
/// validation error has one shape. Controllers no longer need to call ValidateAsync themselves
/// (existing manual calls are harmless: they run after this filter and see a valid request).
/// <para>
/// Config "Validation:Mode": "Enforce" (default) rejects invalid requests; "LogOnly" logs what would
/// have been rejected (a safety valve if a long-unused validator turns out to disagree with a client);
/// "Off" skips this filter.
/// </para>
/// </summary>
public class FluentValidationFilter(IConfiguration config, ILogger<FluentValidationFilter> logger)
    : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var mode = config["Validation:Mode"] ?? "Enforce";
        if (mode.Equals("Off", StringComparison.OrdinalIgnoreCase))
        {
            await next();
            return;
        }

        var failures = new List<FluentValidation.Results.ValidationFailure>();
        foreach (var parameter in context.ActionDescriptor.Parameters)
        {
            if (!context.ActionArguments.TryGetValue(parameter.Name, out var value) || value is null) continue;
            var type = value.GetType();
            if (type.IsPrimitive || type == typeof(string) || type.IsEnum || value is IFormFile) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(type);
            if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(value), context.HttpContext.RequestAborted);
            if (!result.IsValid) failures.AddRange(result.Errors);
        }

        if (failures.Count > 0)
        {
            if (mode.Equals("LogOnly", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Validation would reject {Path}: {Errors}", context.HttpContext.Request.Path.Value,
                    string.Join("; ", failures.Select(f => $"{f.PropertyName}: {f.ErrorMessage}")));
            }
            else
            {
                foreach (var f in failures)
                    context.ModelState.AddModelError(f.PropertyName, f.ErrorMessage);
                context.Result = Infrastructure.Json.ValidationResponses.Create(context);
                return;
            }
        }

        await next();
    }
}
