namespace GymManagmentApplication.Domain.Entities.Identity;

/// <summary>
/// The module master: one row per menu item, page or in-page tab of one frontend app
/// (admin, trainer or member). Roles and users are granted rows from this table, and each
/// app builds its menus and allowed screens from the rows a user is granted. Rows are seeded
/// from <see cref="Application.Access.ModuleCatalog"/>.
/// </summary>
public class Module
{
    public ulong Id { get; set; }
    /// <summary>Unique, app-scoped key — e.g. "admin.members", "member.book.pt".</summary>
    public string Key { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Which frontend the row belongs to: "admin", "trainer" or "member".</summary>
    public string App { get; set; } = default!;
    public ulong? ParentId { get; set; }
    /// <summary>1 = main menu (bottom tab bar), 2 = submenu, and so on.</summary>
    public int Level { get; set; } = 1;
    public int SortOrder { get; set; }
    /// <summary>The frontend screen key (or tab key, for tab rows) this module opens.</summary>
    public string? Route { get; set; }
    /// <summary>
    /// Comma-separated API permission keys this module unlocks — the keys used by
    /// [RequireModule] and [PermissionModule] on controllers (e.g. "classes,pt-sessions").
    /// </summary>
    public string? ApiModules { get; set; }
    public bool HideFromMenu { get; set; }
    /// <summary>A page tab rather than a menu item; returned by the tabs endpoint only.</summary>
    public bool IsTab { get; set; }
    /// <summary>Grantable only to the admin role (tenants, roles, access).</summary>
    public bool AdminOnly { get; set; }
    /// <summary>JSON object of display names by language code, e.g. {"ar":"الأعضاء"}.</summary>
    public string? NameTranslations { get; set; }

    public Module? Parent { get; set; }
    public ICollection<UserModuleAccess> UserAccess { get; set; } = [];
}
