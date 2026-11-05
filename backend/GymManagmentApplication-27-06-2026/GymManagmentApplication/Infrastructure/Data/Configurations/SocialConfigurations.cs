using GymManagmentApplication.Domain.Entities.Social;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GymManagmentApplication.Infrastructure.Data.Configurations;

// Keys, spec column names, the one-like-per-user index and relations of the social tables.
// Column names follow the spec: PostId / ImageId / LikeId / CommentId, CreatedDate, ModifiedDate.

public sealed class SocialPostConfiguration : IEntityTypeConfiguration<SocialPost>
{
    public void Configure(EntityTypeBuilder<SocialPost> e)
    {
        e.Property(x => x.Id).HasColumnName("PostId");
        e.Property(x => x.CreatedAt).HasColumnName("CreatedDate");
        e.Property(x => x.UpdatedAt).HasColumnName("ModifiedDate");
        e.Property(x => x.Caption).HasMaxLength(2200);
        // Feed query: one tenant's live posts, newest first.
        e.HasIndex(x => new { x.TenantId, x.IsDeleted, x.IsActive, x.Id }).IsDescending(false, false, false, true);
        e.HasIndex(x => x.UserId);
        e.HasOne(x => x.Tenant).WithMany().HasForeignKey(x => x.TenantId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SocialPostImageConfiguration : IEntityTypeConfiguration<SocialPostImage>
{
    public void Configure(EntityTypeBuilder<SocialPostImage> e)
    {
        e.Property(x => x.Id).HasColumnName("ImageId");
        e.Property(x => x.CreatedAt).HasColumnName("CreatedDate");
        e.Property(x => x.ImageUrl).HasMaxLength(1000);
        e.HasIndex(x => new { x.PostId, x.DisplayOrder });
        e.HasOne(x => x.Post).WithMany(p => p.Images).HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class SocialPostLikeConfiguration : IEntityTypeConfiguration<SocialPostLike>
{
    public void Configure(EntityTypeBuilder<SocialPostLike> e)
    {
        e.Property(x => x.Id).HasColumnName("LikeId");
        e.Property(x => x.CreatedAt).HasColumnName("CreatedDate");
        e.HasIndex(x => new { x.PostId, x.UserId }).IsUnique();   // one like per user per post
        e.HasIndex(x => x.UserId);
        e.HasOne(x => x.Post).WithMany(p => p.Likes).HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class SocialPostCommentConfiguration : IEntityTypeConfiguration<SocialPostComment>
{
    public void Configure(EntityTypeBuilder<SocialPostComment> e)
    {
        e.Property(x => x.Id).HasColumnName("CommentId");
        e.Property(x => x.CreatedAt).HasColumnName("CreatedDate");
        e.Property(x => x.UpdatedAt).HasColumnName("ModifiedDate");
        e.Property(x => x.CommentText).HasMaxLength(1000);
        e.HasIndex(x => new { x.PostId, x.IsDeleted, x.Id });
        e.HasIndex(x => x.UserId);
        e.HasOne(x => x.Post).WithMany(p => p.Comments).HasForeignKey(x => x.PostId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
    }
}
