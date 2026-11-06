namespace GymManagmentApplication.Domain.Entities.Scheduling;

/// <summary>
/// A freed class spot held for the first waitlisted member until <see cref="ExpiresAt"/>
/// (gym setting "offer" mode). While Pending the seat counts as taken; the member claims it
/// (booking → Booked), declines it, or lets it expire — then it rolls to the next person.
/// The member's <see cref="ClassBooking"/> stays Waitlisted while the offer is open.
/// </summary>
public class WaitlistOffer
{
    public ulong Id { get; set; }
    public ulong TenantId { get; set; }
    public ulong ClassId { get; set; }
    public ulong BookingId { get; set; }
    public ulong ClientId { get; set; }
    /// <summary>One of <see cref="WaitlistOfferStatuses"/>.</summary>
    public string Status { get; set; } = WaitlistOfferStatuses.Pending;
    public DateTime OfferedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RespondedAt { get; set; }

    public GymClass Class { get; set; } = default!;
    public ClassBooking Booking { get; set; } = default!;
}

public static class WaitlistOfferStatuses
{
    public const string Pending = "pending";
    public const string Claimed = "claimed";
    public const string Declined = "declined";
    public const string Expired = "expired";
    /// <summary>The class was cancelled / the booking cancelled while the offer was open.</summary>
    public const string Withdrawn = "withdrawn";
}
