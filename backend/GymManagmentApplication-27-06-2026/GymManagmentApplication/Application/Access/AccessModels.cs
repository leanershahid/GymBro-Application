namespace GymManagmentApplication.Application.Access;

// ── Responses ─────────────────────────────────────────────────────────────

/// <summary>One granted module, as the apps build menus, tabs and screens from it.</summary>
public record AccessModuleResponse(
    string Key, string App, string Name, int Level, string? ParentKey, int SortOrder, string? Icon, string? Route,
    bool HideFromMenu, bool IsTab, string[] ApiModules,
    bool CanCreate, bool CanEdit, bool CanDelete, bool CanExport);

/// <summary>A module master row, for the admin screens that grant access.</summary>
public record ModuleTreeRow(
    string Key, string App, string Name, int Level, string? ParentKey, int SortOrder, string? Icon,
    string? Route, bool HideFromMenu, bool IsTab, bool AdminOnly, string[] ApiModules);

public record ModuleGrantDto(string ModuleKey, bool CanView, bool CanCreate, bool CanEdit, bool CanDelete, bool CanExport);

/// <param name="App">The app the role signs in to; its grants may cover modules of any app.</param>
public record RoleGrantsResponse(ulong RoleId, string RoleName, string RoleSlug, string App, List<ModuleGrantDto> Grants);

public record UserOverrideDto(string ModuleKey, bool IsEnabled, bool CanAdd, bool CanEdit, bool CanDelete);

/// <summary>
/// A user's access screen: what their roles grant (<see cref="FromRoles"/>), their own overrides,
/// and the result (<see cref="Effective"/>).
/// </summary>
public record UserAccessResponse(
    ulong UserId, string App, List<ModuleGrantDto> FromRoles, List<UserOverrideDto> Overrides, List<ModuleGrantDto> Effective);

public record ExtraRoleDto(ulong RoleId, string Name, string Slug);

// ── Requests ──────────────────────────────────────────────────────────────

public record SetRoleGrantsRequest(List<ModuleGrantDto> Grants);

public record SetUserOverridesRequest(List<UserOverrideDto> Overrides);

public record AddExtraRoleRequest(ulong RoleId);
