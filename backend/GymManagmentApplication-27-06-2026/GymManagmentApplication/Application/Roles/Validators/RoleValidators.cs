using FluentValidation;
using GymManagmentApplication.Application.Roles.Requests;

namespace GymManagmentApplication.Application.Roles.Validators;

public class CreateRoleValidator : AbstractValidator<CreateRoleRequest>
{
    public CreateRoleValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(50);
}

public class UpdateRoleValidator : AbstractValidator<UpdateRoleRequest>
{
    public UpdateRoleValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(50).When(x => x.Name is not null);
        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description is not null);
    }
}

public class UpdateRolePermissionsValidator : AbstractValidator<UpdateRolePermissionsRequest>
{
    public UpdateRolePermissionsValidator() => RuleFor(x => x.Permissions).NotNull();
}

public class AssignRoleValidator : AbstractValidator<AssignRoleRequest>
{
    public AssignRoleValidator() => RuleFor(x => x.RoleId).NotEmpty();
}
