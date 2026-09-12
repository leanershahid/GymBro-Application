using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Biometric.Interfaces;
using GymManagmentApplication.Application.Biometric.Requests;
using GymManagmentApplication.Application.Biometric.Responses;
using GymManagmentApplication.Domain.Entities.Facility;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Biometric.Services;

public class BiometricService(AppDbContext db) : IBiometricService
{
    public async Task<BiometricEnrollResponse> EnrollFaceAsync(EnrollFaceRequest request)
    {
        var user = await db.Users.FindAsync(request.UserId);
        if (user is null)
            return new BiometricEnrollResponse { UserId = request.UserId, BiometricType = "Face", Success = false };

        // Store face encoding as JSON — in production replace with a real embedding vector
        user.FaceEncoding = JsonDocument.Parse(JsonSerializer.Serialize(new { hash = Hash(request.FaceImageBase64) }));
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        await LogAccessEventAsync(request.UserId, AccessEventType.Entry, AccessMethod.Face, 1.0m);

        return new BiometricEnrollResponse
        {
            UserId = request.UserId, BiometricType = "Face",
            Success = true, EnrolledAt = DateTime.UtcNow
        };
    }

    public async Task<BiometricVerifyResponse> VerifyFaceAsync(VerifyFaceRequest request)
    {
        // Find any user in the tenant with a face encoding (mock match)
        var user = await db.Users
            .Where(u => u.TenantId == request.TenantId && u.FaceEncoding != null && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        var verified = user is not null;
        await LogAccessEventAsync(user?.Id, AccessEventType.Entry, AccessMethod.Face, verified ? 0.97m : 0.0m);

        return new BiometricVerifyResponse
        {
            Verified = verified, UserId = verified ? user!.Id : null,
            Confidence = verified ? 0.97 : 0.0, VerifiedAt = DateTime.UtcNow
        };
    }

    public async Task<bool> DeleteBiometricAsync(ulong userId)
    {
        var user = await db.Users.FindAsync(userId);
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
            Timestamp    = e.CreatedAt
        }).ToList();
    }

    public async Task<BiometricEnrollResponse> EnrollFingerprintAsync(EnrollFingerprintRequest request)
    {
        var user = await db.Users.FindAsync(request.UserId);
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
        var hash = Hash(request.FingerprintData);
        var user = await db.Users
            .Where(u => u.TenantId == request.TenantId && u.BiometricHash == hash && u.DeletedAt == null)
            .FirstOrDefaultAsync();

        var verified = user is not null;
        await LogAccessEventAsync(user?.Id, AccessEventType.Entry, AccessMethod.Biometric, verified ? 0.99m : 0.0m);

        return new BiometricVerifyResponse
        {
            Verified = verified, UserId = verified ? user!.Id : null,
            Confidence = verified ? 0.99 : 0.0, VerifiedAt = DateTime.UtcNow
        };
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task LogAccessEventAsync(ulong? userId, AccessEventType eventType, AccessMethod method, decimal confidence)
    {
        // Use device Id=1 as default — real deployment uses the actual device FK
        var defaultDevice = await db.AccessDevices.FirstOrDefaultAsync();
        if (defaultDevice is null) return;

        var maxId = await db.AccessEvents.MaxAsync(e => (ulong?)e.Id) ?? 0;
        db.AccessEvents.Add(new AccessEvent
        {
            Id = maxId + 1, DeviceId = defaultDevice.Id,
            UserId = userId, EventType = eventType,
            Method = method, Confidence = confidence,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    private static string Hash(string input) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
}
