using System.Text.Json;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Core;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.SelfService;

/// <summary>
/// A gym's membership rules (TenantSettings key <c>membership-rules</c>). Every rule is enforced on
/// the server; the apps only display them. Defaults suit a typical month-to-month gym.
/// </summary>
public class MembershipRulesSettings
{
    /// <summary>Members can't leave before this many months from their start date (0 = no minimum term).</summary>
    public int MinimumTermMonths { get; set; } = 0;
    /// <summary>Days of notice a cancellation needs: access (and billing) runs at least this long after asking.</summary>
    public int NoticeDays { get; set; } = 30;
    /// <summary>Freeze days a member may use per calendar year (0 = members can't pause themselves).</summary>
    public int MaxFreezeDaysPerYear { get; set; } = 30;
    /// <summary>Shortest pause a member can ask for, in days.</summary>
    public int MinFreezeDays { get; set; } = 7;
    /// <summary>One-off fee per approved pause (0 = free).</summary>
    public decimal FreezeFee { get; set; }
    /// <summary>One-off fee on an approved cancellation (0 = none).</summary>
    public decimal CancellationFee { get; set; }
    /// <summary>Members may ask to cancel from the app (otherwise "speak to the front desk").</summary>
    public bool AllowSelfCancel { get; set; } = true;
    /// <summary>New members may join and buy a plan in the app.</summary>
    public bool AllowOnlineJoin { get; set; } = true;
    /// <summary>Tax added to online membership invoices (e.g. 18 for GST). 0 = prices include tax / no tax.</summary>
    public decimal TaxPercent { get; set; }
    /// <summary>How far ahead a new member may pick their start date.</summary>
    public int MaxStartDaysAhead { get; set; } = 60;
    /// <summary>"auto" = approved at once when within the rules; "staff" = waits for staff.</summary>
    public string FreezeApproval { get; set; } = ApprovalModes.Auto;
    public string CancelApproval { get; set; } = ApprovalModes.Staff;
    public string ChangeApproval { get; set; } = ApprovalModes.Auto;

    public bool AutoApproves(string type) => type switch
    {
        Domain.Entities.Membership.MembershipRequestTypes.Freeze => FreezeApproval == ApprovalModes.Auto,
        Domain.Entities.Membership.MembershipRequestTypes.Cancel => CancelApproval == ApprovalModes.Auto,
        Domain.Entities.Membership.MembershipRequestTypes.Change => ChangeApproval == ApprovalModes.Auto,
        _ => false,
    };

    /// <summary>Throws ArgumentException (400) on an out-of-range value; normalises the approval modes.</summary>
    public void Validate()
    {
        if (MinimumTermMonths is < 0 or > 60) throw new ArgumentException("Minimum term must be between 0 and 60 months.");
        if (NoticeDays is < 0 or > 365) throw new ArgumentException("Notice period must be between 0 and 365 days.");
        if (MaxFreezeDaysPerYear is < 0 or > 365) throw new ArgumentException("Freeze allowance must be between 0 and 365 days a year.");
        if (MinFreezeDays is < 1 or > 365) throw new ArgumentException("Shortest pause must be between 1 and 365 days.");
        if (FreezeFee < 0 || CancellationFee < 0) throw new ArgumentException("Fees can't be negative.");
        if (TaxPercent is < 0 or > 100) throw new ArgumentException("Tax must be between 0 and 100%.");
        if (MaxStartDaysAhead is < 0 or > 365) throw new ArgumentException("Start date window must be between 0 and 365 days.");
        FreezeApproval = ApprovalModes.Normalize(FreezeApproval, nameof(FreezeApproval));
        CancelApproval = ApprovalModes.Normalize(CancelApproval, nameof(CancelApproval));
        ChangeApproval = ApprovalModes.Normalize(ChangeApproval, nameof(ChangeApproval));
        FreezeFee = Money.Round(FreezeFee);
        CancellationFee = Money.Round(CancellationFee);
    }
}

public static class ApprovalModes
{
    public const string Auto = "auto";
    public const string Staff = "staff";

    public static string Normalize(string? value, string field)
    {
        var v = (value ?? Auto).Trim().ToLowerInvariant();
        return v is Auto or Staff ? v : throw new ArgumentException($"{field}: must be \"auto\" or \"staff\".");
    }
}

/// <summary>Loads / saves <see cref="MembershipRulesSettings"/> (same pattern as SafetyGate's settings).</summary>
public static class MembershipRulesStore
{
    public const string SettingKey = "membership-rules";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task<MembershipRulesSettings> LoadAsync(IAppDbContext db, ulong tenantId)
    {
        var row = await db.TenantSettings.IgnoreQueryFilters().AsNoTracking()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        return row?.Value is null ? new MembershipRulesSettings() : row.Value.Deserialize<MembershipRulesSettings>(Json) ?? new MembershipRulesSettings();
    }

    public static async Task<MembershipRulesSettings> SaveAsync(IAppDbContext db, ulong tenantId, MembershipRulesSettings settings)
    {
        settings.Validate();
        var row = await db.TenantSettings.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Key == SettingKey);
        var value = JsonSerializer.SerializeToDocument(settings, Json);
        if (row is null) db.TenantSettings.Add(new TenantSetting { TenantId = tenantId, Key = SettingKey, Value = value });
        else { row.Value = value; row.UpdatedAt = DateTime.UtcNow; }
        await db.SaveChangesAsync();
        return settings;
    }
}
