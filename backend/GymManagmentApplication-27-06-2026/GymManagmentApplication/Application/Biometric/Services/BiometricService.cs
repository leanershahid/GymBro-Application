using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Biometric.Interfaces;
using GymManagmentApplication.Application.Biometric.Requests;
using GymManagmentApplication.Application.Biometric.Responses;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Facility;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Biometric.Services;

public class BiometricService(AppDbContext db, ICurrentUser currentUser, GymManagmentApplication.Application.Attendance.IAttendanceService attendance) : IBiometricService
{
    public async Task<BiometricEnrollResponse> EnrollFaceAsync(EnrollFaceRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId && u.DeletedAt == null);
        if (user is null)
            return new BiometricEnrollResponse { UserId = request.UserId, BiometricType = "Face", Success = false };

        // Store face encoding as JSON — in production replace with a real embedding vector
        user.FaceEncoding = JsonDocument.Parse(JsonSerializer.Serialize(new { hash = Hash(request.FaceImageBase64) }));
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return new BiometricEnrollResponse
        {
            UserId = request.UserId, BiometricType = "Face",
            Success = true, EnrolledAt = DateTime.UtcNow
        };
    }

    public async Task<BiometricVerifyResponse> VerifyFaceAsync(VerifyFaceRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var device = await ResolveDeviceAsync(request.DeviceId, tenantId);

        // Find any user in the tenant with a face encoding (mock match)
        var user = await db.Users
            .Where(u => u.TenantId == tenantId && u.FaceEncoding != null && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        var verified = user is not null;
        await LogAccessEventAsync(device, user?.Id, verified, AccessMethod.Face, verified ? 0.97m : 0.0m);

        return new BiometricVerifyResponse
        {
            Verified = verified, UserId = verified ? user!.Id : null,
            Confidence = verified ? 0.97 : 0.0, VerifiedAt = DateTime.UtcNow
        };
    }

    public async Task<bool> DeleteBiometricAsync(ulong userId)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return false;

        var hadData = user.FaceEncoding != null || user.BiometricHash != null;
        user.FaceEncoding  = null;
        user.BiometricHash = null;
        user.UpdatedAt     = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return hadData;
    }

    public async Task<List<EntryLogResponse>> GetEntryLogsAsync(ulong tenantId, int pageNumber, int pageSize)
    {
        tenantId = currentUser.ResolveTenantId(tenantId);
        var events = await db.AccessEvents
            .Include(e => e.User)
            .Include(e => e.Device).ThenInclude(d => d.Branch)
            .Where(e => e.Device.Branch.TenantId == tenantId)
            .OrderByDescending(e => e.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return events.Select(e => new EntryLogResponse
        {
            LogId        = e.Id,
            UserId       = e.UserId ?? 0,
            EntryType    = e.Method.ToString(),
            AccessGranted = e.EventType == AccessEventType.Entry,
            DeviceId     = e.DeviceId,
            BranchId     = e.Device.BranchId,
            Timestamp    = e.CreatedAt
        }).ToList();
    }

    public async Task<BiometricEnrollResponse> EnrollFingerprintAsync(EnrollFingerprintRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId && u.DeletedAt == null);
        if (user is null)
            return new BiometricEnrollResponse { UserId = request.UserId, BiometricType = "Fingerprint", Success = false };

        user.BiometricHash = Hash(request.FingerprintData);
        user.UpdatedAt     = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return new BiometricEnrollResponse
        {
            UserId = request.UserId, BiometricType = "Fingerprint",
            Success = true, EnrolledAt = DateTime.UtcNow
        };
    }

    public async Task<BiometricVerifyResponse> VerifyFingerprintAsync(VerifyFingerprintRequest request)
    {
        var tenantId = currentUser.ResolveTenantId(request.TenantId);
        var device = await ResolveDeviceAsync(request.DeviceId, tenantId);

        var hash = Hash(request.FingerprintData);
        var user = await db.Users
            .Where(u => u.TenantId == tenantId && u.BiometricHash == hash && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        var verified = user is not null;
        await LogAccessEventAsync(device, user?.Id, verified, AccessMethod.Biometric, verified ? 0.99m : 0.0m);

        return new BiometricVerifyResponse
        {
            Verified = verified, UserId = verified ? user!.Id : null,
            Confidence = verified ? 0.99 : 0.0, VerifiedAt = DateTime.UtcNow
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>The scanner must belong to a branch of the same gym.</summary>
    private async Task<AccessDevice?> ResolveDeviceAsync(ulong? deviceId, ulong tenantId)
    {
        if (deviceId is null) return null;
        return await db.AccessDevices.Include(d => d.Branch)
                   .FirstOrDefaultAsync(d => d.Id == deviceId && d.Branch.TenantId == tenantId)
               ?? throw new ArgumentException($"Access device {deviceId} does not belong to this gym.");
    }

    /// <summary>
    /// Records the scan against the device that captured it. Without a device there is no
    /// branch to attribute the entry to, so nothing is logged (previously every event was
    /// pinned to whichever device happened to be first in the table).
    /// </summary>
    private async Task LogAccessEventAsync(AccessDevice? device, ulong? userId, bool granted, AccessMethod method, decimal confidence)
    {
        if (device is null) return;

        db.AccessEvents.Add(new AccessEvent
        {
            DeviceId = device.Id,
            UserId = userId, EventType = granted ? AccessEventType.Entry : AccessEventType.Denied,
            Method = method, Confidence = confidence,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        // A granted scan is also the member's attendance, when the gym has that method enabled.
        if (granted && userId is { } uid)
            await attendance.RecordBiometricAsync(uid, device.BranchId,
                method == AccessMethod.Face ? AttendanceMethod.Face : AttendanceMethod.Biometric, device.Name);
    }

    private static string Hash(string input) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
}
