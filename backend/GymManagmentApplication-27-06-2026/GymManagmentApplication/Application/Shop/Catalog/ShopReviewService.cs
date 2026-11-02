using System.Globalization;
using GymManagmentApplication.Application.Common;
using GymManagmentApplication.Application.Shop.Common;
using GymManagmentApplication.Domain.Entities.Shop;
using GymManagmentApplication.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace GymManagmentApplication.Application.Shop.Catalog;

// Product reviews, ported from Unique Lights Services/ReviewService.cs. Every non-deleted review is
// visible (the gym shop has no moderation step). One review per member and product.

public interface IShopReviewService
{
    Task<PagedResponse<ShopReviewDto>> GetForProductAsync(ulong productId, int page, int pageSize);
    Task<ShopReviewSummaryDto> GetSummaryAsync(ulong productId);
    Task<ShopReviewDto> CreateAsync(CreateShopReviewRequest request);
    Task DeleteAsync(ulong reviewId);
}

public sealed class ShopReviewService(AppDbContext db, ICurrentUser currentUser) : IShopReviewService
{
    private const string AlreadyReviewed = "You have already reviewed this product";

    private IQueryable<ShopReview> VisibleReviews(ulong productId)
    {
        var tid = currentUser.ResolveTenantId();
        return db.ShopReviews.AsNoTracking().Where(r => r.TenantId == tid && r.ProductId == productId && r.DeletedAt == null);
    }

    private ulong RequireUserId() =>
        currentUser.UserId ?? throw new UnauthorizedAccessException("Unauthorized. Token is missing or invalid.");

    public async Task<PagedResponse<ShopReviewDto>> GetForProductAsync(ulong productId, int page, int pageSize)
    {
        var (p, size) = ShopSearch.Paging(page, pageSize);
        var currentUserId = currentUser.UserId;
        var query = VisibleReviews(productId);
        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id)
            .Skip((p - 1) * size).Take(size)
            .Select(r => new
            {
                r.Id, r.ProductId, r.Rating, r.Title, r.Comment, r.IsVerifiedPurchase, r.CreatedAt, r.UserId,
                r.User.FirstName, r.User.LastName
            })
            .ToListAsync();

        var items = rows.Select(r => new ShopReviewDto
        {
            Id = r.Id,
            ProductId = r.ProductId,
            Rating = r.Rating,
            Title = r.Title,
            Comment = r.Comment,
            AuthorName = ShopMappers.AuthorName(r.FirstName, r.LastName),
            IsVerifiedPurchase = r.IsVerifiedPurchase,
            CreatedAt = r.CreatedAt,
            IsMine = currentUserId.HasValue && r.UserId == currentUserId.Value
        }).ToList();

        return ShopSearch.Page(items, p, size, total);
    }

    public async Task<ShopReviewSummaryDto> GetSummaryAsync(ulong productId)
    {
        var counts = await VisibleReviews(productId)
            .GroupBy(r => r.Rating)
            .Select(g => new { Rating = g.Key, Count = g.Count() })
            .ToListAsync();

        var distribution = Enumerable.Range(1, 5).ToDictionary(
            i => i.ToString(CultureInfo.InvariantCulture),
            i => counts.Where(c => c.Rating == i).Sum(c => c.Count));

        var total = distribution.Values.Sum();
        var average = total == 0 ? 0m : ShopPricing.Round(counts.Sum(c => (decimal)c.Rating * c.Count) / total);

        return new ShopReviewSummaryDto { AverageRating = average, ReviewCount = total, Distribution = distribution };
    }

    public async Task<ShopReviewDto> CreateAsync(CreateShopReviewRequest request)
    {
        ShopValidation.Require(request.ProductId > 0, "productId is required.");
        ShopValidation.Require(request.Rating is >= 1 and <= 5, "rating must be between 1 and 5.");
        ShopValidation.MaxLength(request.Title, 120, "title");
        ShopValidation.MaxLength(request.Comment, 2000, "comment");

        var userId = RequireUserId();
        var tid = currentUser.ResolveTenantId();

        var product = await db.ShopProducts.FirstOrDefaultAsync(p =>
                          p.Id == request.ProductId && p.TenantId == tid && p.DeletedAt == null && p.IsActive)
                      ?? throw new KeyNotFoundException("Product not found");

        if (await db.ShopReviews.AnyAsync(r => r.ProductId == product.Id && r.UserId == userId && r.DeletedAt == null))
        {
            throw new ArgumentException(AlreadyReviewed);
        }

        var user = await db.Users.AsNoTracking()
                       .Where(u => u.Id == userId)
                       .Select(u => new { u.FirstName, u.LastName })
                       .FirstOrDefaultAsync()
                   ?? throw new UnauthorizedAccessException("Unauthorized. Token is missing or invalid.");

        var verified = await db.ShopOrderItems.AnyAsync(i =>
            i.ProductId == product.Id && i.Order.UserId == userId && i.Order.Status != ShopOrderStatus.Cancelled);

        var review = new ShopReview
        {
            TenantId = product.TenantId,
            ProductId = product.Id,
            UserId = userId,
            Rating = (short)request.Rating,
            Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
            IsVerifiedPurchase = verified
        };
        db.ShopReviews.Add(review);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation } pg
                                           && pg.ConstraintName?.StartsWith("PK_", StringComparison.Ordinal) != true)
        {
            throw new ArgumentException(AlreadyReviewed);
        }

        await RecalculateProductRatingAsync(product.Id);

        return new ShopReviewDto
        {
            Id = review.Id,
            ProductId = review.ProductId,
            Rating = review.Rating,
            Title = review.Title,
            Comment = review.Comment,
            AuthorName = ShopMappers.AuthorName(user.FirstName, user.LastName),
            IsVerifiedPurchase = review.IsVerifiedPurchase,
            CreatedAt = review.CreatedAt,
            IsMine = true
        };
    }

    public async Task DeleteAsync(ulong reviewId)
    {
        var userId = RequireUserId();
        var tid = currentUser.ResolveTenantId();
        var review = await db.ShopReviews.FirstOrDefaultAsync(r => r.Id == reviewId && r.TenantId == tid && r.DeletedAt == null)
                     ?? throw new KeyNotFoundException("Review not found");
        // UnauthorizedAccessException → 403 in ExceptionMiddleware.
        if (review.UserId != userId && !currentUser.IsAdmin)
            throw new UnauthorizedAccessException("You can only delete your own reviews");

        review.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await RecalculateProductRatingAsync(review.ProductId);
    }

    /// <summary>Recomputes the product's AverageRating / ReviewCount from non-deleted reviews.</summary>
    private async Task RecalculateProductRatingAsync(ulong productId)
    {
        var stats = await db.ShopReviews.AsNoTracking()
            .Where(r => r.ProductId == productId && r.DeletedAt == null)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Average = g.Average(r => (decimal)r.Rating) })
            .FirstOrDefaultAsync();

        var count = stats?.Count ?? 0;
        var average = stats is null ? 0m : ShopPricing.Round(stats.Average);

        await db.ShopProducts
            .Where(p => p.Id == productId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.AverageRating, average)
                .SetProperty(p => p.ReviewCount, count));
    }
}
