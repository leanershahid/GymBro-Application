/**
 * Screens of Help & feedback (roadmap feature 6) for the area routers.
 *
 * Member area (memberRoutes.ts / MemberApp.tsx), always open (no module):
 *   { id: 'help' }                          /member/help              → <HelpCentreScreen onBack onNew onOpen />
 *   { id: 'help-new' }                      /member/help-new          → <NewHelpRequestScreen onBack onCreated />
 *   { id: 'help-request'; requestId }       /member/help-request/{id} → <HelpRequestScreen requestId onBack onNew />
 *   Home: <ClassFeedbackCard />  ("How was {class}?" after an attended class).  Profile / More: "Help & feedback".
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), module `admin.support` (route key 'support'):
 *   'support'              /admin/support              → <SupportQueuePage onBack onOpen />
 *   'support-request' + id /admin/support-request/{id} → <SupportRequestPage requestId onBack onOpenMember />
 *   Badge (unassigned + overdue): useSupportBadge().
 *
 * Trainer area (trainerRoutes.ts / TrainerApp.tsx), always open — only requests assigned to them:
 *   'support' / 'support-request' + id  → the same pages with mode="trainer".
 */
export * from './routePaths';

export { default as HelpCentreScreen } from './screens/HelpCentreScreen';
export { default as NewHelpRequestScreen } from './screens/NewHelpRequestScreen';
export { default as HelpRequestScreen } from './screens/HelpRequestScreen';
export { default as ClassFeedbackCard } from './components/ClassFeedbackCard';
export { default as SupportQueuePage } from './pages/SupportQueuePage';
export { default as SupportRequestPage } from './pages/SupportRequestPage';
export { default as AssignedSupportCard } from './components/AssignedSupportCard';
export { useSupportBadge, useSupportCount } from './api/supportQueries';
