using GymManagmentApplication.Application.Biometric.Requests;
using GymManagmentApplication.Application.Biometric.Responses;

namespace GymManagmentApplication.Application.Biometric.Interfaces;

public interface IBiometricService
{
    Task<BiometricEnrollResponse> EnrollFaceAsync(EnrollFaceRequest request);
    Task<BiometricVerifyResponse> VerifyFaceAsync(VerifyFaceRequest request);
    Task<bool> DeleteBiometricAsync(ulong userId);
    Task<List<EntryLogResponse>> GetEntryLogsAsync(ulong tenantId, int pageNumber, int pageSize);
    Task<BiometricEnrollResponse> EnrollFingerprintAsync(EnrollFingerprintRequest request);
    Task<BiometricVerifyResponse> VerifyFingerprintAsync(VerifyFingerprintRequest request);
}
