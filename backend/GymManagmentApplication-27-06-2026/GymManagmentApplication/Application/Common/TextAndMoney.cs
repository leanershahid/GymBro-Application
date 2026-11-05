using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace GymManagmentApplication.Application.Common;

/// <summary>Money helpers shared by billing and the shop (ARCH-108).</summary>
public static class Money
{
    /// <summary>Round half away from zero to 2 decimals.</summary>
    public static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

/// <summary>
/// One email normalisation for every write and lookup (ARCH-044): trimmed and lower-cased, so
/// "Jo@Gym.com" and "jo@gym.com" are the same account under the unique Email index.
/// </summary>
public static class EmailAddress
{
    public static string? Normalize(string? email) =>
        string.IsNullOrWhiteSpace(email) ? email : email.Trim().ToLowerInvariant();
}

/// <summary>URL/identifier slugs shared by roles and the shop (ARCH-108).</summary>
public static partial class Slug
{
    /// <summary>
    /// Lower-case ASCII slug: accents stripped, every run of other characters becomes one "-",
    /// trimmed of "-", at most 200 characters; <paramref name="fallback"/> when nothing is left.
    /// </summary>
    public static string From(string? value, string fallback = "item")
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);

        var slug = NonAlphanumeric().Replace(sb.ToString(), "-").Trim('-');
        slug = MultipleHyphens().Replace(slug, "-");
        if (slug.Length > 200) slug = slug[..200].Trim('-');
        return slug.Length == 0 ? fallback : slug;
    }

    [GeneratedRegex("[^a-z0-9]+")] private static partial Regex NonAlphanumeric();
    [GeneratedRegex("-{2,}")] private static partial Regex MultipleHyphens();
}
