using FluentValidation;
using GymManagmentApplication.Application.Branch.Requests;

namespace GymManagmentApplication.Application.Branch.Validators;

public class UpdateBranchValidator : AbstractValidator<UpdateBranchRequest>
{
    public UpdateBranchValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).When(x => x.Name is not null);
        RuleFor(x => x.Address).MaximumLength(500).When(x => x.Address is not null);
        RuleFor(x => x.City).MaximumLength(100).When(x => x.City is not null);
        RuleFor(x => x.State).MaximumLength(100).When(x => x.State is not null);
        RuleFor(x => x.Country).MaximumLength(100).When(x => x.Country is not null);
        RuleFor(x => x.Zip).MaximumLength(20).When(x => x.Zip is not null);
        RuleFor(x => x.Phone).MaximumLength(30).When(x => x.Phone is not null);
        RuleFor(x => x.Email).EmailAddress().When(x => x.Email is not null);
        RuleFor(x => x.Timezone).MaximumLength(100).When(x => x.Timezone is not null);
        RuleFor(x => x.Capacity).GreaterThan((ushort)0).When(x => x.Capacity.HasValue);
        RuleFor(x => x.LogoUrl).MaximumLength(500).When(x => x.LogoUrl is not null);
        RuleFor(x => x.Status).IsInEnum().When(x => x.Status.HasValue);
    }
}
