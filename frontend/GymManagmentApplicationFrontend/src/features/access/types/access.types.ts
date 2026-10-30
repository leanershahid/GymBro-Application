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

/** The shell asking an area's screens to open `route`; `at` makes a repeat tap reopen it. */
export interface OpenRequest {
  route: string;
  at: number;
}

/** Props every area's screens take when the shell hosts them. */
export interface ShellHosted {
  /** Screen the shell wants open. */
  open?: OpenRequest;
  /** Reports the screen showing, so the shell can highlight its tab. */
  onRouteChange?: (route: string) => void;
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
