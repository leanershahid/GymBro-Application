namespace GymManagmentApplication.Domain.Entities.Scheduling;

/// <summary>
/// A consequence applied to a member for a late cancel or a no-show (gym "booking-rules"
/// settings): a fee (with its invoice) and/or a strike. One row per booking / PT session and
/// type (unique indexes), so marking attendance twice never penalises twice.
/// </summary>
public class BookingPenalty
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ClientId { get; set; }
    /// <summary>One of <see cref="BookingPenaltyTypes"/>.</summary>
    public string Type { get; set; } = BookingPenaltyTypes.NoShow;
    /// <summary>The class booking (classes); null for PT.</summary>
    public ulong? BookingId { get; set; }
    public ulong? ClassId { get; set; }
    /// <summary>The PT session; null for classes.</summary>
    public ulong? PtSessionId { get; set; }
    /// <summary>When the class / session was due to start (for display and the strike window).</summary>
    public DateTime SessionStartsAt { get; set; }
    /// <summary>The fee charged (null = no fee).</summary>
    public decimal? FeeAmount { get; set; }
    public ulong? FeeInvoiceId { get; set; }
    public Billing.Invoice? FeeInvoice { get; set; }
    public bool Strike { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Staff who marked the no-show / null for the member's own late cancel or the auto no-show job.</summary>
    public ulong? CreatedBy { get; set; }

    public bool Waived { get; set; }
    public DateTime? WaivedAt { get; set; }
    public ulong? WaivedBy { get; set; }
    public string? WaiveReason { get; set; }

    public Identity.User Client { get; set; } = default!;
}

public static class BookingPenaltyTypes
{
    public const string LateCancel = "late_cancel";
    public const string NoShow = "no_show";
}

/// <summary>
/// The member may not book themselves (classes / PT) between <see cref="From"/> and
/// <see cref="Until"/>; staff can still book on their behalf. Created when strikes in the rolling
/// window reach the gym's threshold; staff can lift it early.
/// </summary>
public class BookingBlock
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ClientId { get; set; }
    public DateTime From { get; set; }
    public DateTime Until { get; set; }
    public string Reason { get; set; } = default!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LiftedAt { get; set; }
    public ulong? LiftedBy { get; set; }
    public string? LiftReason { get; set; }
    /// <summary>Set once the member was told the block ended (lifted or expired).</summary>
    public DateTime? EndNotifiedAt { get; set; }

    public Identity.User Client { get; set; } = default!;

    public bool IsActive(DateTime utcNow) => LiftedAt is null && From <= utcNow && Until > utcNow;
}
