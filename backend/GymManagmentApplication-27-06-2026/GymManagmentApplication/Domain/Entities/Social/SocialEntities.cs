using GymManagmentApplication.Domain.Entities.Core;
using GymManagmentApplication.Domain.Entities.Identity;

namespace GymManagmentApplication.Domain.Entities.Social;

// The social feed: image posts, likes and comments. People come from the existing Users table;
// nothing here duplicates user data. Column names follow the module spec (PostId, CreatedDate, …)
// and are mapped in AppDbContext.ConfigureSocial.

public class SocialPost : BaseEntity
{
    public ulong TenantId { get; set; }
    public ulong UserId { get; set; }
    public string? Caption { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }

    public Tenant Tenant { get; set; } = default!;
    public User User { get; set; } = default!;
    public ICollection<SocialPostImage> Images { get; set; } = [];
    public ICollection<SocialPostLike> Likes { get; set; } = [];
    public ICollection<SocialPostComment> Comments { get; set; } = [];
}

public class SocialPostImage : BaseEntity
{
    public ulong PostId { get; set; }
    public string ImageUrl { get; set; } = default!;
    public int DisplayOrder { get; set; }

    public SocialPost Post { get; set; } = default!;
}

/// <summary>One row per (post, user): a unique index makes a second like impossible.</summary>
public class SocialPostLike : BaseEntity
{
    public ulong PostId { get; set; }
    public ulong UserId { get; set; }

    public SocialPost Post { get; set; } = default!;
    public User User { get; set; } = default!;
}

public class SocialPostComment : BaseEntity
{
    public ulong PostId { get; set; }
    public ulong UserId { get; set; }
    public string CommentText { get; set; } = default!;
    public bool IsDeleted { get; set; }

    public SocialPost Post { get; set; } = default!;
    public User User { get; set; } = default!;
}
