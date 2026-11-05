/**
 * Menu holders that only exist to list other modules (ARCH-141: one list for AppShell and the
 * admin dashboard). The shell's own More screen replaces them, so they never get a tab or tile.
 */
export const MENU_CONTAINER_ROUTES: ReadonlySet<string> = new Set(['more-actions']);
