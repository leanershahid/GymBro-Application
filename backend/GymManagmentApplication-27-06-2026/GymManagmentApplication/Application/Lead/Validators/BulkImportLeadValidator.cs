using FluentValidation;
using GymManagmentApplication.Application.Lead.Requests;

namespace GymManagmentApplication.Application.Lead.Validators;

public class BulkImportLeadValidator : AbstractValidator<BulkImportLeadRequest>
{
    public BulkImportLeadValidator()
    {
        RuleFor(x => x.Leads).NotEmpty();
        RuleForEach(x => x.Leads).SetValidator(new CreateLeadValidator());
    }
}
