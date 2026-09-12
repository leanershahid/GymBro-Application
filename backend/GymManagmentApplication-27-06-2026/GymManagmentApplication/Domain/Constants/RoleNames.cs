namespace GymManagmentApplication.Domain.Constants;

/// <summary>
/// Canonical system role slugs, matching the "admin" &gt; "trainer" &gt; "client" hierarchy
/// seeded in <see cref="Infrastructure.Data.DbSeeder"/>. Controllers should reference these
/// constants in <see cref="Filters.AuthorizeRolesAttribute"/> rather than repeating string
/// literals, so the set of valid roles lives in exactly one place.
/// </summary>
public static class RoleNames
{
    public const string Admin = "admin";
    public const string Trainer = "trainer";
    public const string Client = "client";
    public const string Staff = "staff";
}
