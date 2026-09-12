using FluentValidation;
using GymManagmentApplication.Application.ModuleAccess.Requests;

namespace GymManagmentApplication.Application.ModuleAccess.Validators;

public class SetModuleAccessValidator : AbstractValidator<SetModuleAccessRequest>
{
    public SetModuleAccessValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.RoleId).GreaterThan(0ul).WithMessage("RoleId is required.");
        RuleFor(x => x.Module)
            .NotEmpty().WithMessage("Module is required.")
            .MaximumLength(100).WithMessage("Module key must be 100 characters or fewer.");
    }
}

public class BulkSetModuleAccessValidator : AbstractValidator<BulkSetModuleAccessRequest>
{
    public BulkSetModuleAccessValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan(0ul).WithMessage("TenantId is required.");
        RuleFor(x => x.RoleId).GreaterThan(0ul).WithMessage("RoleId is required.");
        RuleFor(x => x.Modules)
            .NotEmpty().WithMessage("At least one module entry is required.")
            .Must(m => m.Count <= 50).WithMessage("Maximum 50 module entries per bulk request.");
        RuleForEach(x => x.Modules)
            .ChildRules(m => m.RuleFor(e => e.Module)
                .NotEmpty().WithMessage("Each module entry must have a Module key."));
    }
}

public class CheckModuleAccessValidator : AbstractValidator<CheckModuleAccessRequest>
{
    private static readonly string[] ValidActions = ["view", "create", "edit", "delete", "export"];

    public CheckModuleAccessValidator()
    {
        RuleFor(x => x.RoleId).GreaterThan(0ul).WithMessage("RoleId is required.");
        RuleFor(x => x.Module).NotEmpty().WithMessage("Module is required.");
        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("Action is required.")
            .Must(a => ValidActions.Contains(a.ToLower()))
            .WithMessage("Action must be one of: view, create, edit, delete, export.");
    }
}
