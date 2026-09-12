using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Trainer.Interfaces;
using GymManagmentApplication.Application.Trainer.Requests;
using GymManagmentApplication.Application.Trainer.Responses;
using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Training;
using GymManagmentApplication.Domain.Enums;
using GymManagmentApplication.Infrastructure.Repositories;

namespace GymManagmentApplication.Application.Trainer.Services;

public class TrainerService(ITrainerRepository repository) : ITrainerService
{
    private static readonly JsonSerializerOptions _opts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task<PagedResponse<TrainerResponse>> GetAllAsync(int pageNumber, int pageSize)
    {
        var (items, total) = await repository.GetAllAsync(pageNumber, pageSize);
        return new PagedResponse<TrainerResponse>
        {
            Items = items.Select(MapToResponse),
            PageNumber = pageNumber,
            PageSize = pageSize,
            TotalRecords = total
        };
    }

    public async Task<TrainerResponse> CreateAsync(CreateTrainerRequest request)
    {
        var user = new User
        {
            Uuid = Guid.NewGuid().ToString(),
            TenantId = request.BranchId,
            Email = request.Email,
            Phone = request.Phone,
            FirstName = request.DisplayName,
            LastName = null,
            PasswordHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("123"))),
            Status = UserStatus.Active,
            RoleId = 2
        };
        var createdUser = await repository.CreateUserAsync(user);

        var trainer = new TrainerProfile
        {
            UserId = createdUser.Id,
            BranchId = request.BranchId,
            TrainerCode = request.TrainerCode,
            DisplayName = request.DisplayName,
            ProfileImage = request.ProfileImage,
            Bio = request.Bio,
            ExperienceYears = request.ExperienceYears,
            Gender = request.Gender,
            DateOfBirth = request.DateOfBirth,
            Phone = request.Phone,
            Email = request.Email,
            Address = request.Address,
            Notes = request.Notes,
            LanguagesKnown = ToJson(request.LanguagesKnown),
            Specializations = ToJson(request.Specializations),
            Certifications = ToJson(request.Certifications),
            Employment = ToJson(request.Employment),
            Salary = ToJson(request.Salary),
            Allowances = ToJson(request.Allowances),
            Deductions = ToJson(request.Deductions),
            PaymentDetails = ToJson(request.PaymentDetails),
            Availability = ToJson(request.Availability),
            BookingSettings = ToJson(request.BookingSettings),
            CommissionSettings = ToJson(request.CommissionSettings),
            AttendanceSettings = ToJson(request.AttendanceSettings),
            Documents = ToJson(request.Documents),
            EmergencyContact = ToJson(request.EmergencyContact),
            SocialLinks = ToJson(request.SocialLinks),
        };
        var created = await repository.CreateAsync(trainer);
        return MapToResponse(created);
    }

    public async Task<TrainerResponse?> GetByIdAsync(ulong id)
    {
        var trainer = await repository.GetByIdAsync(id);
        return trainer is null ? null : MapToResponse(trainer);
    }

    public async Task<TrainerResponse?> UpdateAsync(ulong id, UpdateTrainerRequest request)
    {
        var trainer = await repository.GetByIdAsync(id);
        if (trainer is null) return null;
        if (request.DisplayName is not null) trainer.DisplayName = request.DisplayName;
        if (request.Bio is not null) trainer.Bio = request.Bio;
        if (request.Phone is not null) trainer.Phone = request.Phone;
        if (request.Email is not null) trainer.Email = request.Email;
        if (request.ProfileImage is not null) trainer.ProfileImage = request.ProfileImage;
        if (request.IsAvailable.HasValue) trainer.IsAvailable = request.IsAvailable.Value;
        await repository.UpdateAsync(trainer);
        return MapToResponse(trainer);
    }

    public async Task<List<TrainerClientResponse>> GetClientsAsync(ulong id)
    {
        var assignments = await repository.GetClientAssignmentsAsync(id);
        return assignments.Select(a => new TrainerClientResponse
        {
            AssignmentId = a.Id,
            ClientId = a.ClientId,
            Status = a.Status.ToString(),
            AssignedAt = a.AssignedAt
        }).ToList();
    }

    public async Task<TrainerClientResponse> AssignClientAsync(ulong id, AssignClientRequest request)
    {
        var assignment = new TrainerClientAssignment
        {
            TrainerId = id,
            ClientId = request.ClientId,
            BranchId = request.BranchId,
            Notes = request.Notes,
            Status = TrainerAssignmentStatus.Active
        };
        var created = await repository.AddClientAssignmentAsync(assignment);
        return new TrainerClientResponse
        {
            AssignmentId = created.Id,
            ClientId = created.ClientId,
            Status = created.Status.ToString(),
            AssignedAt = created.AssignedAt
        };
    }

    public Task<bool> UnassignClientAsync(ulong trainerId, ulong clientId) =>
        repository.RemoveClientAssignmentAsync(trainerId, clientId);

    public async Task<List<TrainerScheduleResponse>> GetScheduleAsync(ulong id)
    {
        var slots = await repository.GetSlotsAsync(id);
        return slots.Select(s => new TrainerScheduleResponse
        {
            DayOfWeek = s.DayOfWeek,
            StartTime = s.StartTime,
            EndTime = s.EndTime,
            IsActive = s.IsActive
        }).ToList();
    }

    public async Task<bool> SetScheduleAsync(ulong id, SetScheduleRequest request)
    {
        var slots = request.Slots.Select(s => new TrainerAvailabilitySlot
        {
            DayOfWeek = s.DayOfWeek,
            StartTime = s.StartTime,
            EndTime = s.EndTime,
            IsActive = s.IsActive
        }).ToList();
        await repository.SetSlotsAsync(id, slots);
        return true;
    }

    public async Task<TrainerPerformanceResponse> GetPerformanceAsync(ulong id)
    {
        var trainer = await repository.GetByIdAsync(id);
        var clients = await repository.GetClientAssignmentsAsync(id);
        return new TrainerPerformanceResponse
        {
            TrainerId = id,
            TotalClients = clients.Count,
            TotalSessions = trainer?.TotalSessions ?? 0,
            Rating = trainer?.Rating
        };
    }

    public async Task<TrainerEarningsResponse> GetEarningsAsync(ulong id, int month, int year)
    {
        await repository.GetByIdAsync(id);
        return new TrainerEarningsResponse { TrainerId = id, TotalEarnings = 0, CommissionEarned = 0, Month = month, Year = year };
    }

    public async Task<TrainerResponse?> AutoAssignAsync(ulong clientId, ulong branchId)
    {
        var trainers = await repository.GetAvailableTrainersAsync(branchId);
        var trainer = trainers.MinBy(t => t.TotalSessions);
        return trainer is null ? null : MapToResponse(trainer);
    }

    private static TrainerResponse MapToResponse(TrainerProfile t) => new()
    {
        Id = t.Id, UserId = t.UserId, BranchId = t.BranchId, TrainerCode = t.TrainerCode,
        DisplayName = t.DisplayName, ProfileImage = t.ProfileImage, Bio = t.Bio,
        ExperienceYears = t.ExperienceYears, Gender = t.Gender, DateOfBirth = t.DateOfBirth,
        Phone = t.Phone, Email = t.Email, Address = t.Address, Notes = t.Notes,
        Rating = t.Rating, IsAvailable = t.IsAvailable, CreatedAt = t.CreatedAt,
        LanguagesKnown = FromJson<List<string>>(t.LanguagesKnown),
        Specializations = FromJson<List<string>>(t.Specializations),
        Certifications = FromJson<object>(t.Certifications),
        Employment = FromJson<object>(t.Employment), Salary = FromJson<object>(t.Salary),
        Allowances = FromJson<object>(t.Allowances), Deductions = FromJson<object>(t.Deductions),
        PaymentDetails = FromJson<object>(t.PaymentDetails), Availability = FromJson<object>(t.Availability),
        BookingSettings = FromJson<object>(t.BookingSettings), CommissionSettings = FromJson<object>(t.CommissionSettings),
        AttendanceSettings = FromJson<object>(t.AttendanceSettings), Documents = FromJson<object>(t.Documents),
        EmergencyContact = FromJson<object>(t.EmergencyContact), SocialLinks = FromJson<object>(t.SocialLinks),
    };

    private static JsonDocument? ToJson<T>(T? value) =>
        value is null ? null : JsonDocument.Parse(JsonSerializer.Serialize(value, _opts));

    private static T? FromJson<T>(JsonDocument? doc) =>
        doc is null ? default : JsonSerializer.Deserialize<T>(doc.RootElement.GetRawText(), _opts);
}
