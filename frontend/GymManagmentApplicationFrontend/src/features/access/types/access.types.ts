/** One module the signed-in user is granted (GET /access/me and /access/me/tabs). */
export interface AccessModule {
  key: string;
  /** The app the module belongs to — a person may hold modules of several apps. */
  app: AccessApp;
  name: string;
  level: number;
  parentKey: string | null;
  sortOrder: number;
  icon: string | null;
  /** Screen key the module opens (tab key, for tab rows). */
  route: string | null;
  hideFromMenu: boolean;
  isTab: boolean;
  /** API permission keys this module unlocks — e.g. ['classes', 'pt-sessions']. */
  apiModules: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

/** Everything the apps build menus, tabs and screens from. */
export interface AccessList {
  modules: AccessModule[];
  tabs: AccessModule[];
}

export type AccessApp = 'admin' | 'trainer' | 'member';

/**
 * The shell asking an area's screens to open `path` (e.g. ['members'], ['workout', '12'];
 * [] = the area's landing screen). A new object each time, so a repeat tap reopens it.
 */
export interface OpenRequest {
  path: string[];
  at: number;
}

/** Where an area is, as it reports it to the shell (src/navigation). */
export interface AreaLocation {
  /** Full route path inside the area, ids included — becomes the web URL and a history entry. */
  path: string[];
  /** Menu module the screen belongs to, so its tab stays lit. */
  module: string;
  /** The screen replaced the previous one (e.g. checkout → order confirmed) instead of opening over it. */
  replace?: boolean;
}

/** Props every area's screens take when the shell hosts them. */
export interface ShellHosted {
  /** Screen the shell wants open. */
  open?: OpenRequest;
  /** Reports every screen change (route + ids), for the tab bar, history and URL. */
  onRouteChange?: (loc: AreaLocation) => void;
}

/** A module master row, for the admin screens that grant access. */
export interface ModuleTreeRow {
  key: string;
  app: AccessApp;
  name: string;
  level: number;
  parentKey: string | null;
  sortOrder: number;
  icon: string | null;
  route: string | null;
  hideFromMenu: boolean;
  isTab: boolean;
  adminOnly: boolean;
  apiModules: string[];
}

export interface ModuleGrant {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface RoleGrants {
  roleId: number;
  roleName: string;
  roleSlug: string;
  app: AccessApp;
  grants: ModuleGrant[];
}

/** A preset set of grants offered when creating a role (GET /access/templates). */
export interface RoleTemplate {
  key: string;
  name: string;
  description: string;
  grants: ModuleGrant[];
}

/** People holding a role (main or additional) and modules it grants. */
export interface RoleSummary {
  roleId: number;
  people: number;
  modules: number;
}

/** Someone whose main role is admin, staff or a custom role. */
export interface StaffMember {
  userId: number;
  name: string;
  email: string | null;
  roleName: string;
  roleSlug: string;
}

/** A per-user override: Allow (isEnabled) with these flags, or Deny. */
export interface UserOverride {
  moduleKey: string;
  isEnabled: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface UserAccess {
  userId: number;
  app: AccessApp;
  fromRoles: ModuleGrant[];
  overrides: UserOverride[];
  effective: ModuleGrant[];
}

export interface ExtraRole {
  roleId: number;
  name: string;
  slug: string;
}
