using FluentValidation;
using GymManagmentApplication.Application.Branch.Requests;

namespace GymManagmentApplication.Application.Branch.Validators;

public class CreateBranchValidator : AbstractValidator<CreateBranchRequest>
{
    public CreateBranchValidator()
    {
        RuleFor(x => x.TenantId).GreaterThan((ulong)0).WithMessage("TenantId is required.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50);
        RuleFor(x => x.ParentId).Must(id => id is null || id > 0)
            .WithMessage("ParentId must be null or a valid branch id.");
    }
}
