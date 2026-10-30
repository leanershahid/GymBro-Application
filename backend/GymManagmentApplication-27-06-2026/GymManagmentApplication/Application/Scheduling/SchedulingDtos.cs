namespace GymManagmentApplication.Application.Scheduling;

// ── Class types ─────────────────────────────────────────────────────────────
public class ClassTypeRequest
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public short? DurationMin { get; set; }
    public short? MaxCapacity { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ClassTypeResponse
{
    public ulong Id { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public short? DurationMin { get; set; }
    public short? MaxCapacity { get; set; }
    public string? Color { get; set; }
    public bool IsActive { get; set; }
}

// ── Classes ─────────────────────────────────────────────────────────────────
public class CreateClassRequest
{
    public ulong ClassTypeId { get; set; }
    public ulong BranchId { get; set; }
    public ulong? TrainerId { get; set; }
    public string? Title { get; set; }
    public DateTime StartsAt { get; set; }
    /// <summary>Defaults to the class type's duration (or 60 min).</summary>
    public short? DurationMin { get; set; }
    public short? MaxCapacity { get; set; }
    public string? Notes { get; set; }
    /// <summary>Also schedule the same class weekly for this many more weeks (0–26).</summary>
    public int RepeatWeeks { get; set; }
}

public class UpdateClassRequest
{
    public ulong? TrainerId { get; set; }
    public string? Title { get; set; }
    public DateTime? StartsAt { get; set; }
    public short? DurationMin { get; set; }
    public short? MaxCapacity { get; set; }
    public string? Notes { get; set; }
}

public class CancelClassRequest
{
    public string? Reason { get; set; }
    /// <summary>Cancel this and all later classes of the same weekly series.</summary>
    public bool WholeSeries { get; set; }
}

public class ClassResponse
{
    public ulong Id { get; set; }
    public ulong ClassTypeId { get; set; }
    public string ClassTypeName { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string? Color { get; set; }
    public ulong BranchId { get; set; }
    public string? BranchName { get; set; }
    public ulong? TrainerId { get; set; }
    public string? TrainerName { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public short? Capacity { get; set; }
    public int Booked { get; set; }
    public int Waitlisted { get; set; }
    public string Status { get; set; } = default!;
    public ulong? SeriesId { get; set; }
    public string? Notes { get; set; }
    /// <summary>The caller's own booking status for this class (members), if any.</summary>
    public string? MyBooking { get; set; }
}

public class BookClassRequest
{
    /// <summary>Staff booking for a member; members always book themselves.</summary>
    public ulong? ClientId { get; set; }
}

public class RosterEntryResponse
{
    public ulong BookingId { get; set; }
    public ulong ClientId { get; set; }
    public string ClientName { get; set; } = default!;
    public string Status { get; set; } = default!;
    public DateTime BookedAt { get; set; }
}

public class MarkAttendanceRequest
{
    public ulong ClientId { get; set; }
    public bool Attended { get; set; }
}

// ── Personal training ───────────────────────────────────────────────────────
public class PtTypeRequest
{
    /// <summary>Admin only; trainers always manage their own types.</summary>
    public ulong? TrainerId { get; set; }
    public string Name { get; set; } = default!;
    public short DurationMin { get; set; } = 60;
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class PtTypeResponse
{
    public ulong Id { get; set; }
    public ulong TrainerId { get; set; }
    public string? TrainerName { get; set; }
    public string Name { get; set; } = default!;
    public short DurationMin { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class BookPtRequest
{
    public ulong SessionTypeId { get; set; }
    /// <summary>Trainer/admin booking for a member; members book themselves.</summary>
    public ulong? ClientId { get; set; }
    public DateTime StartsAt { get; set; }
    public string? Notes { get; set; }
}

public class UpdatePtStatusRequest
{
    /// <summary>confirmed | completed | cancelled | noshow</summary>
    public string Status { get; set; } = default!;
    public string? TrainerNotes { get; set; }
}

public class RatePtRequest
{
    public byte Rating { get; set; }
}

public class PtSessionResponse
{
    public ulong Id { get; set; }
    public ulong SessionTypeId { get; set; }
    public string SessionTypeName { get; set; } = default!;
    public ulong TrainerId { get; set; }
    public string? TrainerName { get; set; }
    public ulong ClientId { get; set; }
    public string? ClientName { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string Status { get; set; } = default!;
    public decimal? Price { get; set; }
    public string? Currency { get; set; }
    public string? Notes { get; set; }
    public string? TrainerNotes { get; set; }
    public byte? Rating { get; set; }
    public ulong? InvoiceId { get; set; }
}
