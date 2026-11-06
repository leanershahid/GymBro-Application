/**
 * Screens of the privacy feature (delete my account, download my data, consents) for the area routers.
 *
 * Member area (memberRoutes.ts / MemberApp.tsx): { id: 'privacy' }  path: /member/privacy (always open)
 *   → <PrivacyCentreScreen onBack onSignOut onOpenRoute />
 *   Mount once: <PendingDeletionBanner onOpenPrivacy />  ("Keep my account" while a deletion is scheduled).
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), module `admin.privacy` (route key 'privacy-requests'):
 *   → <PrivacyRequestsPage onBack onOpenMember />
 *   Member detail: <MemberPrivacySection memberId memberName />  (hidden without the module).
 */
export const PRIVACY_ADMIN_ROUTE = 'privacy-requests' as const;

export { default as PrivacyCentreScreen } from './screens/PrivacyCentreScreen';
export { default as PrivacyRequestsPage } from './pages/PrivacyRequestsPage';
export { default as PendingDeletionBanner } from './components/PendingDeletionBanner';
export { default as MemberPrivacySection } from './components/MemberPrivacySection';
