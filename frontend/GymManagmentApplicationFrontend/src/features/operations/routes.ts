/**
 * Gym operations screens (opening hours, service status, announcements) and how to mount them.
 * Self-contained: nothing here is wired into the area routers yet (the navigation owner adds the
 * entries below to adminRoutes.ts / AdminRouter.tsx and memberRoutes.ts / MemberApp.tsx).
 *
 * Module keys (backend ModuleCatalog): admin.announcements → route 'announcements',
 * admin.service-status → 'service-status', admin.branches.hours → 'branch-hours' (hidden child of
 * Branches), member.announcements → 'announcements', member.branch-info → 'branch-info'.
 */
export { default as AnnouncementsScreen } from './screens/AnnouncementsScreen';
export { default as AnnouncementDetailScreen } from './screens/AnnouncementDetailScreen';
export { default as BranchInfoScreen } from './screens/BranchInfoScreen';
export { default as AnnouncementsAdminPage } from './pages/AnnouncementsAdminPage';
export { default as AnnouncementEditorPage } from './pages/AnnouncementEditorPage';
export { default as BranchHoursPage } from './pages/BranchHoursPage';
export { default as ServiceStatusAdminPage } from './pages/ServiceStatusAdminPage';
// Home widgets (render nothing when there is nothing to show).
export { default as ServiceStatusBanner } from './components/ServiceStatusBanner';
export { default as LatestAnnouncementCard } from './components/LatestAnnouncementCard';
export { useUnreadAnnouncements } from './api/operationsQueries';

/** Admin area: screen keys, the module route each belongs to, and whether the URL carries an id. */
export const OPERATIONS_ADMIN_ROUTES = [
  { screen: 'announcements', owner: 'announcements', id: false },
  { screen: 'announcement-editor', owner: 'announcements', id: 'optional' },   // /admin/announcement-editor[/{id}]
  { screen: 'service-status', owner: 'service-status', id: false },
  { screen: 'branch-hours', owner: 'branch-hours', id: 'optional' },           // /admin/branch-hours[/{branchId}]
] as const;

/** Member area: route ids and paths. */
export const OPERATIONS_MEMBER_ROUTES = [
  { id: 'announcements', path: ['announcements'], module: 'home' },               // feed
  { id: 'announcement', path: ['announcements', '{id}'], module: 'home' },         // detail
  { id: 'branch-info', path: ['branch-info', '{branchId?}'], module: 'home' },     // gym info
] as const;
