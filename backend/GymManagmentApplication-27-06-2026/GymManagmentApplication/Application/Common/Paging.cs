namespace GymManagmentApplication.Application.Common;

/// <summary>Normalises page/size query values: page ≥ 1, 1 ≤ size ≤ MaxSize (so page=0 or size=100000 can't break or dump a table).</summary>
public static class Paging
{
    public const int MaxSize = 100;

    public static (int Page, int Size) Clamp(int page, int size, int defaultSize = 20) =>
        (Math.Max(1, page), size <= 0 ? defaultSize : Math.Min(size, MaxSize));
}

public static class PagingExtensions
{
    /// <summary>Skip/Take for a 1-based page, with <see cref="Paging.Clamp"/> applied.</summary>
    public static IQueryable<T> Page<T>(this IQueryable<T> query, int page, int size)
    {
        var (p, s) = Paging.Clamp(page, size);
        return query.Skip((p - 1) * s).Take(s);
    }
}
