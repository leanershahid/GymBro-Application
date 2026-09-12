using FluentValidation;
using GymManagmentApplication.Application.Member.Requests;

namespace GymManagmentApplication.Application.Member.Validators;

public class BulkImportMemberValidator : AbstractValidator<BulkImportMemberRequest>
{
    public BulkImportMemberValidator()
    {
        RuleFor(x => x.Members).NotEmpty();
        RuleForEach(x => x.Members).SetValidator(new CreateMemberValidator());
    }
}
