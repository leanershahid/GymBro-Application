using FluentValidation;
using GymManagmentApplication.Application.Biometric.Requests;

namespace GymManagmentApplication.Application.Biometric.Validators;

public class EnrollFaceValidator : AbstractValidator<EnrollFaceRequest>
{
    public EnrollFaceValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0ul);
        RuleFor(x => x.FaceImageBase64).NotEmpty();
    }
}

public class VerifyFaceValidator : AbstractValidator<VerifyFaceRequest>
{
    public VerifyFaceValidator()
    {
        RuleFor(x => x.FaceImageBase64).NotEmpty();
        RuleFor(x => x.TenantId).GreaterThan(0ul);
    }
}

public class EnrollFingerprintValidator : AbstractValidator<EnrollFingerprintRequest>
{
    public EnrollFingerprintValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0ul);
        RuleFor(x => x.FingerprintData).NotEmpty();
    }
}

public class VerifyFingerprintValidator : AbstractValidator<VerifyFingerprintRequest>
{
    public VerifyFingerprintValidator()
    {
        RuleFor(x => x.FingerprintData).NotEmpty();
        RuleFor(x => x.TenantId).GreaterThan(0ul);
    }
}
