using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Domain.Entities.Social;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Social;

public interface ISocialPostService
{
    Task<SocialFeedDto> GetFeedAsync(ulong? cursor, int pageSize);
    Task<SocialPostDto> GetAsync(ulong postId);
    Task<SocialPostDto> CreateAsync(string? caption, IReadOnlyList<FileUpload> images);
    Task DeleteAsync(ulong postId);
}

public interface ISocialLikeService
{
    Task<SocialLikeStateDto> LikeAsync(ulong postId);
    Task<SocialLikeStateDto> UnlikeAsync(ulong postId);
}

public interface ISocialCommentService
{
    Task<PagedResponse<SocialCommentDto>> ListAsync(ulong postId, int pageNumber, int pageSize);
    Task<SocialCommentDto> AddAsync(ulong postId, string? text);
    Task<SocialCommentDto> UpdateAsync(ulong commentId, string? text);
    Task DeleteAsync(ulong commentId);
}

/// <summary>Shared rules: who is calling, which tenant's posts they may see, and how URLs are shaped.</summary>
internal static class SocialRules
{
    public const int MaxCaption = 2200;
    public const int MaxComment = 1000;
    public const int MaxImages = 10;
    public const long MaxImageBytes = 5 * 1024 * 1024;
    public const int MaxPageSize = 30;

    public static ulong Me(ICurrentUser u) => u.UserId ?? throw new UnauthorizedAccessException("Please sign in again.");
    public static ulong Tenant(ICurrentUser u) => u.TenantId ?? throw new UnauthorizedAccessException("Your session has no tenant. Please sign in again.");

    /// <summary>Live posts of the caller's gym. Never trust a tenant or user id from the request.</summary>
    public static IQueryable<SocialPost> Visible(IAppDbContext db, ICurrentUser u)
    {
        var tenant = Tenant(u);
        return db.SocialPosts.AsNoTracking().Where(p => p.TenantId == tenant && !p.IsDeleted && p.IsActive);
    }

    public static string CleanText(string? text, int max, string field, bool required)
    {
        var t = (text ?? string.Empty).Replace("\r\n", "\n").Trim();
        if (required && t.Length == 0) throw new ArgumentException($"{field} can't be empty.");
        if (t.Length > max) throw new ArgumentException($"{field} can be at most {max} characters.");
        return t;
    }

    /// <summary>Resized rendition: a Cloudinary transform inserted after /upload/; other hosts are left unchanged.</summary>
    public static string Resize(string url, string transform)
    {
        const string marker = "/upload/";
        var i = url.IndexOf(marker, StringComparison.Ordinal);
        return url.Contains("res.cloudinary.com", StringComparison.OrdinalIgnoreCase) && i > 0
            ? url.Insert(i + marker.Length, transform + "/")
            : url;
    }

    public static string DisplayName(string name) => string.IsNullOrWhiteSpace(name) ? "Member" : name.Trim();
}

public class SocialPostService(IAppDbContext db, ICurrentUser currentUser, IFileStorage storage, ILogger<SocialPostService> logger) : ISocialPostService
{
    public async Task<SocialFeedDto> GetFeedAsync(ulong? cursor, int pageSize)
    {
        var me = SocialRules.Me(currentUser);
        pageSize = Math.Clamp(pageSize, 1, SocialRules.MaxPageSize);

        var query = SocialRules.Visible(db, currentUser);
        if (cursor is > 0) query = query.Where(p => p.Id < cursor);

        // One round trip: counts, "liked by me", images and the latest comments are all correlated
        // subqueries of the page's posts, so nothing is loaded per post.
        var rows = await Project(query.OrderByDescending(p => p.Id).Take(pageSize + 1), me).ToListAsync();

        var hasMore = rows.Count > pageSize;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        foreach (var r in rows) Shape(r, me);

        logger.LogInformation("Social feed page: user {UserId}, cursor {Cursor}, returned {Count}, hasMore {HasMore}", me, cursor, rows.Count, hasMore);
        return new SocialFeedDto { Items = rows, NextCursor = hasMore ? rows[^1].Id : null };
    }

    public async Task<SocialPostDto> GetAsync(ulong postId)
    {
        var me = SocialRules.Me(currentUser);
        var row = await Project(SocialRules.Visible(db, currentUser).Where(p => p.Id == postId), me).FirstOrDefaultAsync()
                  ?? throw new KeyNotFoundException("Post not found.");
        Shape(row, me);
        return row;
    }

    public async Task<SocialPostDto> CreateAsync(string? caption, IReadOnlyList<FileUpload> images)
    {
        var me = SocialRules.Me(currentUser);
        var tenant = SocialRules.Tenant(currentUser);
        var text = SocialRules.CleanText(caption, SocialRules.MaxCaption, "Caption", required: false);

        if (images.Count == 0) throw new ArgumentException("Add at least one photo.");
        if (images.Count > SocialRules.MaxImages) throw new ArgumentException($"You can add up to {SocialRules.MaxImages} photos per post.");
        foreach (var f in images) await ValidateImageAsync(f);

        // Files first; if saving the rows fails, take the files back out so nothing is orphaned.
        var folder = $"tenants/{tenant}/social/{me}";
        var urls = new List<string>();
        try
        {
            foreach (var f in images) urls.Add(await storage.SaveAsync(f, folder, FileKind.Image));

            var post = new SocialPost { TenantId = tenant, UserId = me, Caption = text.Length == 0 ? null : text };
            for (var i = 0; i < urls.Count; i++) post.Images.Add(new SocialPostImage { ImageUrl = urls[i], DisplayOrder = i });
            db.SocialPosts.Add(post);
            await db.SaveChangesAsync();

            logger.LogInformation("Social post {PostId} created by user {UserId} with {Images} image(s)", post.Id, me, urls.Count);
            return await GetAsync(post.Id);
        }
        catch
        {
            foreach (var u in urls) await storage.DeleteAsync(u);
            throw;
        }
    }

    public async Task DeleteAsync(ulong postId)
    {
        var me = SocialRules.Me(currentUser);
        var tenant = SocialRules.Tenant(currentUser);
        var post = await db.SocialPosts.FirstOrDefaultAsync(p => p.Id == postId && p.TenantId == tenant && !p.IsDeleted)
                   ?? throw new KeyNotFoundException("Post not found.");
        if (post.UserId != me && !currentUser.IsAdmin)
            throw new UnauthorizedAccessException("You can only delete your own posts.");

        post.IsDeleted = true;   // soft delete: comments, likes and images stay for audit
        await db.SaveChangesAsync();
        logger.LogInformation("Social post {PostId} deleted by user {UserId} (owner {OwnerId})", postId, me, post.UserId);
    }

    /// <summary>
    /// The page of posts as DTOs in ONE query. Users are joined with query filters off: the feed is gym-wide
    /// (the posts are already limited to the caller's tenant), so a member's branch must not hide a post.
    /// </summary>
    private IQueryable<SocialPostDto> Project(IQueryable<SocialPost> posts, ulong me)
    {
        var users = db.Users.IgnoreQueryFilters().AsNoTracking();
        return
            from p in posts
            join u in users on p.UserId equals u.Id
            select new SocialPostDto
            {
                Id = p.Id,
                Caption = p.Caption,
                CreatedAt = p.CreatedAt,
                User = new SocialUserDto { Id = u.Id, Name = u.FirstName + " " + u.LastName, AvatarUrl = u.AvatarUrl },
                Images = p.Images.OrderBy(i => i.DisplayOrder).Select(i => new SocialImageDto { Id = i.Id, Url = i.ImageUrl, DisplayOrder = i.DisplayOrder }).ToList(),
                LikeCount = p.Likes.Count(),
                CommentCount = p.Comments.Count(c => !c.IsDeleted),
                LikedByMe = p.Likes.Any(l => l.UserId == me),
                CommentsPreview = (
                    from c in p.Comments
                    where !c.IsDeleted
                    join cu in users on c.UserId equals cu.Id
                    orderby c.Id descending
                    select new SocialCommentDto
                    {
                        Id = c.Id, PostId = c.PostId, Text = c.CommentText, CreatedAt = c.CreatedAt, ModifiedAt = c.UpdatedAt,
                        User = new SocialUserDto { Id = cu.Id, Name = cu.FirstName + " " + cu.LastName, AvatarUrl = cu.AvatarUrl },
                    }).Take(2).ToList(),
            };
    }

    /// <summary>Everything that needs C# rather than SQL: renditions, names, permissions, comment order.</summary>
    private void Shape(SocialPostDto p, ulong me)
    {
        p.User.Name = SocialRules.DisplayName(p.User.Name);
        p.CanDelete = p.User.Id == me || currentUser.IsAdmin;
        foreach (var i in p.Images)
        {
            i.ThumbUrl = SocialRules.Resize(i.Url, "w_720,c_limit,q_auto,f_auto");
            i.Url = SocialRules.Resize(i.Url, "w_1440,c_limit,q_auto,f_auto");
        }
        p.CommentsPreview.Reverse();   // the newest two were fetched; show them chronologically
        foreach (var c in p.CommentsPreview)
        {
            c.User.Name = SocialRules.DisplayName(c.User.Name);
            c.IsEdited = c.ModifiedAt > c.CreatedAt.AddSeconds(1);
            c.CanEdit = c.User.Id == me;
            c.CanDelete = c.User.Id == me || p.User.Id == me || currentUser.IsAdmin;
        }
    }

    /// <summary>Type by declared content type AND file signature, plus size: a renamed file is rejected.</summary>
    private static async Task ValidateImageAsync(FileUpload f)
    {
        var name = string.IsNullOrWhiteSpace(f.FileName) ? "image" : Path.GetFileName(f.FileName);
        if (f.Length == 0) throw new ArgumentException($"{name} is empty.");
        if (f.Length > SocialRules.MaxImageBytes) throw new ArgumentException($"{name} is too large (max {SocialRules.MaxImageBytes / (1024 * 1024)} MB).");
        var type = f.ContentType?.ToLowerInvariant();
        if (type is not ("image/jpeg" or "image/jpg" or "image/png" or "image/webp"))
            throw new ArgumentException($"{name}: only JPEG, PNG and WEBP images are allowed.");

        var head = new byte[12];
        await using (var s = f.OpenReadStream()) _ = await s.ReadAsync(head.AsMemory(0, 12));
        var jpeg = head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF;
        var png = head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47;
        var webp = head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F' && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P';
        if (!(jpeg || png || webp)) throw new ArgumentException($"{name} isn't a valid JPEG, PNG or WEBP image.");
    }
}

public class SocialLikeService(IAppDbContext db, ICurrentUser currentUser, ILogger<SocialLikeService> logger) : ISocialLikeService
{
    public async Task<SocialLikeStateDto> LikeAsync(ulong postId)
    {
        var me = SocialRules.Me(currentUser);
        await EnsureVisibleAsync(postId);

        if (!await db.SocialPostLikes.AnyAsync(l => l.PostId == postId && l.UserId == me))
        {
            db.SocialPostLikes.Add(new SocialPostLike { PostId = postId, UserId = me });
            try { await db.SaveChangesAsync(); }
            catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23505" })
            {
                // Two taps at once: the unique (PostId, UserId) index kept it to one like. Same outcome as "already liked".
                logger.LogInformation("Duplicate like ignored for post {PostId} by user {UserId}", postId, me);
            }
        }
        return await StateAsync(postId, liked: true);
    }

    public async Task<SocialLikeStateDto> UnlikeAsync(ulong postId)
    {
        var me = SocialRules.Me(currentUser);
        await EnsureVisibleAsync(postId);
        await db.SocialPostLikes.Where(l => l.PostId == postId && l.UserId == me).ExecuteDeleteAsync();
        return await StateAsync(postId, liked: false);
    }

    private async Task EnsureVisibleAsync(ulong postId)
    {
        if (!await SocialRules.Visible(db, currentUser).AnyAsync(p => p.Id == postId))
            throw new KeyNotFoundException("Post not found.");
    }

    private async Task<SocialLikeStateDto> StateAsync(ulong postId, bool liked) => new()
    {
        PostId = postId, LikedByMe = liked,
        LikeCount = await db.SocialPostLikes.CountAsync(l => l.PostId == postId),
    };
}

public class SocialCommentService(IAppDbContext db, ICurrentUser currentUser, ILogger<SocialCommentService> logger) : ISocialCommentService
{
    public async Task<PagedResponse<SocialCommentDto>> ListAsync(ulong postId, int pageNumber, int pageSize)
    {
        var me = SocialRules.Me(currentUser);
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, SocialRules.MaxPageSize);
        var owner = await PostOwnerAsync(postId);

        var query = db.SocialPostComments.AsNoTracking().Where(c => c.PostId == postId && !c.IsDeleted);
        var total = await query.CountAsync();
        var users = db.Users.IgnoreQueryFilters().AsNoTracking();   // gym-wide, like the feed
        var items = await (
            from c in query.OrderBy(c => c.Id).Skip((pageNumber - 1) * pageSize).Take(pageSize)   // chronological, paged in SQL
            join u in users on c.UserId equals u.Id
            orderby c.Id
            select new SocialCommentDto
            {
                Id = c.Id, PostId = c.PostId, Text = c.CommentText, CreatedAt = c.CreatedAt, ModifiedAt = c.UpdatedAt,
                User = new SocialUserDto { Id = u.Id, Name = u.FirstName + " " + u.LastName, AvatarUrl = u.AvatarUrl },
            }).ToListAsync();
        foreach (var c in items) Shape(c, me, owner);

        return new PagedResponse<SocialCommentDto> { Items = items, PageNumber = pageNumber, PageSize = pageSize, TotalRecords = total };
    }

    public async Task<SocialCommentDto> AddAsync(ulong postId, string? text)
    {
        var me = SocialRules.Me(currentUser);
        var clean = SocialRules.CleanText(text, SocialRules.MaxComment, "Comment", required: true);
        var owner = await PostOwnerAsync(postId);

        var comment = new SocialPostComment { PostId = postId, UserId = me, CommentText = clean };
        db.SocialPostComments.Add(comment);
        await db.SaveChangesAsync();
        logger.LogInformation("Comment {CommentId} added to post {PostId} by user {UserId}", comment.Id, postId, me);
        return await LoadAsync(comment.Id, me, owner);
    }

    public async Task<SocialCommentDto> UpdateAsync(ulong commentId, string? text)
    {
        var me = SocialRules.Me(currentUser);
        var clean = SocialRules.CleanText(text, SocialRules.MaxComment, "Comment", required: true);
        var comment = await FindAsync(commentId);
        if (comment.UserId != me) throw new UnauthorizedAccessException("You can only edit your own comments.");

        comment.CommentText = clean;
        await db.SaveChangesAsync();   // UpdatedAt (ModifiedDate) is stamped by the context
        return await LoadAsync(commentId, me, await PostOwnerAsync(comment.PostId));
    }

    public async Task DeleteAsync(ulong commentId)
    {
        var me = SocialRules.Me(currentUser);
        var comment = await FindAsync(commentId);
        var owner = await PostOwnerAsync(comment.PostId);
        if (comment.UserId != me && owner != me && !currentUser.IsAdmin)
            throw new UnauthorizedAccessException("You can only delete your own comments, or comments on your own posts.");

        comment.IsDeleted = true;
        await db.SaveChangesAsync();
        logger.LogInformation("Comment {CommentId} deleted by user {UserId} (author {AuthorId}, post owner {OwnerId})", commentId, me, comment.UserId, owner);
    }

    /// <summary>The comment, only while its post is still visible to the caller's gym.</summary>
    private async Task<SocialPostComment> FindAsync(ulong commentId)
    {
        var tenant = SocialRules.Tenant(currentUser);
        return await db.SocialPostComments
                   .Where(c => c.Id == commentId && !c.IsDeleted && !c.Post.IsDeleted && c.Post.IsActive && c.Post.TenantId == tenant)
                   .FirstOrDefaultAsync()
               ?? throw new KeyNotFoundException("Comment not found.");
    }

    private async Task<ulong> PostOwnerAsync(ulong postId) =>
        await SocialRules.Visible(db, currentUser).Where(p => p.Id == postId).Select(p => (ulong?)p.UserId).FirstOrDefaultAsync()
        ?? throw new KeyNotFoundException("Post not found.");

    private async Task<SocialCommentDto> LoadAsync(ulong commentId, ulong me, ulong postOwner)
    {
        var dto = await (
            from c in db.SocialPostComments.AsNoTracking()
            where c.Id == commentId
            join u in db.Users.IgnoreQueryFilters().AsNoTracking() on c.UserId equals u.Id
            select new SocialCommentDto
            {
                Id = c.Id, PostId = c.PostId, Text = c.CommentText, CreatedAt = c.CreatedAt, ModifiedAt = c.UpdatedAt,
                User = new SocialUserDto { Id = u.Id, Name = u.FirstName + " " + u.LastName, AvatarUrl = u.AvatarUrl },
            }).FirstAsync();
        Shape(dto, me, postOwner);
        return dto;
    }

    private void Shape(SocialCommentDto c, ulong me, ulong postOwner)
    {
        c.User.Name = SocialRules.DisplayName(c.User.Name);
        c.IsEdited = c.ModifiedAt > c.CreatedAt.AddSeconds(1);
        c.CanEdit = c.User.Id == me;
        c.CanDelete = c.User.Id == me || postOwner == me || currentUser.IsAdmin;
    }
}

public static class SocialRegistration
{
    public static IServiceCollection AddSocial(this IServiceCollection services)
    {
        services.AddScoped<ISocialPostService, SocialPostService>();
        services.AddScoped<ISocialLikeService, SocialLikeService>();
        services.AddScoped<ISocialCommentService, SocialCommentService>();
        return services;
    }
}
