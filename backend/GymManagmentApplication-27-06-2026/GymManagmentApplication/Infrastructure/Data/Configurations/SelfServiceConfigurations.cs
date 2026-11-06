using GymManagmentApplication.Domain.Entities.Identity;
using GymManagmentApplication.Domain.Entities.Membership;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Member self-service (feature 4): freeze / cancel / change requests, and the plan columns used
// by the online plan browser. MembershipRequests has a ulong TenantId, so the tenant filter applies.

public sealed class MembershipRequestConfiguration : IEntityTypeConfiguration<MembershipRequest>
{
    public void Configure(EntityTypeBuilder<MembershipRequest> b)
    {
        b.ToTable("MembershipRequests");
        b.Property(x => x.Type).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ReasonCode).HasMaxLength(40);
        b.Property(x => x.Reason).HasMaxLength(1000);
        b.Property(x => x.DecisionNote).HasMaxLength(1000);
        b.Property(x => x.Fee).HasPrecision(18, 2);
        b.HasOne(x => x.Membership).WithMany().HasForeignKey(x => x.MembershipId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        // Staff queue (pending first, by type) and the job's "approved and due" scan.
        b.HasIndex(x => new { x.TenantId, x.Status, x.Type, x.RequestedAt });
        b.HasIndex(x => new { x.MembershipId, x.Status });
        b.HasIndex(x => new { x.TenantId, x.UserId });
        b.HasTenantForeignKeyRestrict();
    }
}

/// <summary>The online-sales columns of MembershipPlans (the rest is in BillingConfigurations).</summary>
public sealed class MembershipPlanSelfServiceConfiguration : IEntityTypeConfiguration<MembershipPlan>
{
    public void Configure(EntityTypeBuilder<MembershipPlan> b)
    {
        // IsPublic: no HasDefaultValue (a store default would swallow an explicit false); the migration
        // should add the column with defaultValue: true so existing plans stay visible.
        b.Property(e => e.JoiningFee).HasPrecision(18, 2);
        b.Property(e => e.AccessHours).HasMaxLength(120);
    }
}
