namespace GymManagmentApplication.Application.Scheduling;

/// <summary>GET /api/booking-rules/settings: the stored rules plus what the app needs to show them.</summary>
public class BookingRulesSettingsResponse : BookingRulesSettings
{
    /// <summary>False while class credits aren't consumed on booking: "lose credit" is hidden.</summary>
    public bool CreditsSupported { get; set; }
    public string Currency { get; set; } = "INR";
}

/// <summary>What members see before booking / cancelling (effective consequences only).</summary>
public class BookingPolicyResponse
{
    public int ClassCancelCutoffHours { get; set; }
    public int PtCancelCutoffHours { get; set; }
    /// <summary>none | fee</summary>
    public string LateCancelConsequence { get; set; } = BookingRulesSettings.None;
    public decimal? LateCancelFee { get; set; }
    /// <summary>none | fee | strike</summary>
    public string NoShowConsequence { get; set; } = BookingRulesSettings.None;
    public decimal? NoShowFee { get; set; }
    public int StrikesBeforeBlock { get; set; }
    public int StrikeWindowDays { get; set; }
    public int BlockDays { get; set; }
    public string Currency { get; set; } = "INR";
}

public class BookingBlockResponse
{
    public ulong Id { get; set; }
    public DateTime From { get; set; }
    public DateTime Until { get; set; }
    public string Reason { get; set; } = default!;
    public DateTime? LiftedAt { get; set; }
    public string? LiftReason { get; set; }
}

public class BookingPenaltyResponse
{
    public ulong Id { get; set; }
    public ulong ClientId { get; set; }
    public string? ClientName { get; set; }
    /// <summary>late_cancel | no_show</summary>
    public string Type { get; set; } = default!;
    public ulong? BookingId { get; set; }
    public ulong? ClassId { get; set; }
    public ulong? PtSessionId { get; set; }
    /// <summary>Class title or PT session type.</summary>
    public string? Label { get; set; }
    public DateTime SessionStartsAt { get; set; }
    public decimal? FeeAmount { get; set; }
    public string? Currency { get; set; }
    public ulong? FeeInvoiceId { get; set; }
    public string? FeeInvoiceNo { get; set; }
    /// <summary>The fee invoice's status (Sent, Paid, Void…).</summary>
    public string? FeeInvoiceStatus { get; set; }
    public bool Strike { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool Waived { get; set; }
    public DateTime? WaivedAt { get; set; }
    public string? WaivedByName { get; set; }
    public string? WaiveReason { get; set; }
}

/// <summary>A member's strikes, block and recent penalties (My bookings / member detail).</summary>
public class BookingStandingResponse
{
    public ulong ClientId { get; set; }
    /// <summary>Strikes counting towards the next block.</summary>
    public int Strikes { get; set; }
    public int StrikesBeforeBlock { get; set; }
    public int StrikeWindowDays { get; set; }
    /// <summary>False when the gym's no-show consequence isn't "strike" (the counter is then hidden).</summary>
    public bool StrikesEnabled { get; set; }
    public BookingBlockResponse? ActiveBlock { get; set; }
    public List<BookingPenaltyResponse> Penalties { get; set; } = [];
    /// <summary>Staff: whether the caller may waive / lift.</summary>
    public bool CanWaive { get; set; }
}

public class WaivePenaltyRequest
{
    public string Reason { get; set; } = default!;
}

public class LiftBlockRequest
{
    public string? Reason { get; set; }
}

public class WaivePenaltyResponse
{
    public BookingPenaltyResponse Penalty { get; set; } = default!;
    /// <summary>True when the unpaid fee invoice was voided; false when there was none or it was already paid.</summary>
    public bool FeeVoided { get; set; }
}
