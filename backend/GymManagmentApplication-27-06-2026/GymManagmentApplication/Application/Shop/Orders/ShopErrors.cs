using GymManagmentApplication.Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Application.Shop.Orders;

/// <summary>The shop's flavour of <see cref="RuleException"/> (kept so existing shop code reads the same).</summary>
public sealed class ShopRuleException(string message, int statusCode) : RuleException(message, statusCode)
{
    public static new ShopRuleException Conflict(string message) => new(message, ConflictStatus);
    public static ShopRuleException Rule(string message) => new(message, UnprocessableStatus);
}

/// <summary>
/// Turns any <see cref="RuleException"/> into the usual { success: false, message } body with its
/// status, and <see cref="NotSupportedException"/> into 501. Registered globally as an MVC filter
/// (ARCH-096), so it applies to every controller, not only the two shop ones that carried the
/// attribute; the attribute form still works where it is applied.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ShopErrorsAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        var (status, message) = context.Exception switch
        {
            RuleException ex => (ex.StatusCode, ex.Message),
            NotSupportedException ex => (StatusCodes.Status501NotImplemented, ex.Message),
            _ => (0, null as string),
        };
        if (status == 0 || context.ExceptionHandled) return;
        var body = ApiResponse<object>.Fail(message!);
        if (context.Exception is RuleException { Code: not null } coded) { body.Code = coded.Code; body.Data = coded.Payload; }
        context.Result = new JsonResult(body) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
