using GymManagmentApplication.Domain.Entities.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Two-step sign-in (roadmap feature 10): authenticator secret, recovery codes, login challenges
// and remembered devices. Every row belongs to a user and goes with them (cascade).

public sealed class UserTwoFactorConfiguration : IEntityTypeConfiguration<UserTwoFactor>
{
    public void Configure(EntityTypeBuilder<UserTwoFactor> b)
    {
        b.HasIndex(x => x.UserId).IsUnique();
        b.Property(x => x.SecretProtected).HasMaxLength(512);
        b.Property(x => x.PendingSecretProtected).HasMaxLength(512);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TwoFactorRecoveryCodeConfiguration : IEntityTypeConfiguration<TwoFactorRecoveryCode>
{
    public void Configure(EntityTypeBuilder<TwoFactorRecoveryCode> b)
    {
        b.HasIndex(x => x.UserId);
        b.Property(x => x.CodeHash).HasMaxLength(128).IsRequired();
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TwoFactorChallengeConfiguration : IEntityTypeConfiguration<TwoFactorChallenge>
{
    public void Configure(EntityTypeBuilder<TwoFactorChallenge> b)
    {
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => x.UserId);
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TrustedDeviceConfiguration : IEntityTypeConfiguration<TrustedDevice>
{
    public void Configure(EntityTypeBuilder<TrustedDevice> b)
    {
        b.HasIndex(x => x.TokenHash).IsUnique();
        b.HasIndex(x => x.UserId);
        b.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        b.Property(x => x.UserAgent).HasMaxLength(255);
        b.Property(x => x.IpAddress).HasMaxLength(64);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
