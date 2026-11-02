namespace GymManagmentApplication.Application.Social;

public class SocialUserDto
{
    public ulong Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public class SocialImageDto
{
    public ulong Id { get; set; }
    public string Url { get; set; } = string.Empty;
    /// <summary>Smaller rendition for the feed (Cloudinary transform when available, else the same URL).</summary>
    public string ThumbUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

public class SocialCommentDto
{
    public ulong Id { get; set; }
    public ulong PostId { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ModifiedAt { get; set; }
    public bool IsEdited { get; set; }
    public SocialUserDto User { get; set; } = new();
    /// <summary>Only the author edits.</summary>
    public bool CanEdit { get; set; }
    /// <summary>The author, the post's owner (moderation) and admins delete.</summary>
    public bool CanDelete { get; set; }
}

public class SocialPostDto
{
    public ulong Id { get; set; }
    public string? Caption { get; set; }
    public DateTime CreatedAt { get; set; }
    public SocialUserDto User { get; set; } = new();
    public List<SocialImageDto> Images { get; set; } = [];
    public int LikeCount { get; set; }
    public int CommentCount { get; set; }
    public bool LikedByMe { get; set; }
    /// <summary>The latest two comments, oldest first.</summary>
    public List<SocialCommentDto> CommentsPreview { get; set; } = [];
    public bool CanDelete { get; set; }
}

/// <summary>Cursor page of the feed: pass <see cref="NextCursor"/> back as <c>cursor</c> for older posts.</summary>
public class SocialFeedDto
{
    public List<SocialPostDto> Items { get; set; } = [];
    public ulong? NextCursor { get; set; }
    public bool HasMore => NextCursor.HasValue;
}

public class SocialLikeStateDto
{
    public ulong PostId { get; set; }
    public bool LikedByMe { get; set; }
    public int LikeCount { get; set; }
}

public class SocialCommentRequest
{
    public string? Text { get; set; }
}
