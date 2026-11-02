using GymManagmentApplication.Application.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace GymManagmentApplication.Application.Shop.Orders;

/// <summary>
/// A shop rule the request broke, carrying the status the store answers with:
/// 409 for stock / duplicate conflicts, 422 for business rules (empty cart, coupon rules, status moves).
/// 400 and 404 keep using ArgumentException / KeyNotFoundException (handled by the global middleware).
/// </summary>
public sealed class ShopRuleException(string message, int statusCode) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public static ShopRuleException Conflict(string message) => new(message, StatusCodes.Status409Conflict);
    public static ShopRuleException Rule(string message) => new(message, StatusCodes.Status422UnprocessableEntity);
}

/// <summary>
/// Turns <see cref="ShopRuleException"/> into the usual { success: false, message } body with its status,
/// so the shop controllers can answer 409/422 without changing the global exception middleware.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ShopErrorsAttribute : ExceptionFilterAttribute
{
    public override void OnException(ExceptionContext context)
    {
        if (context.Exception is not ShopRuleException ex) return;
        context.Result = new JsonResult(ApiResponse<object>.Fail(ex.Message)) { StatusCode = ex.StatusCode };
        context.ExceptionHandled = true;
    }
}
