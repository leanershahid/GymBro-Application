/**
 * Screens of trainer ↔ member messaging (roadmap feature 8) for the area routers.
 *
 * Member area (memberRoutes.ts / MemberApp.tsx), always open (no module):
 *   { id: 'messages' }                         /member/messages            → <MessagesScreen side="member" onBack onOpen />
 *   { id: 'message-thread'; conversationId }   /member/message-thread/{id} → <MessageThreadScreen conversationId onBack onOpenWorkout onOpenPlan />
 *   Home: <MessagesEntryCard side="member" />.  Profile: "Messages".
 *
 * Trainer area (trainerRoutes.ts / TrainerApp.tsx), always open:
 *   'messages' / 'message-thread' + id → the same screens with side="trainer". Home: <MessagesEntryCard side="trainer" />;
 *   client detail: "Message" (useOpenConversation → message-thread).
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), module `admin.messages` (route key 'messages-review'):
 *   'messages-review'                 /admin/messages-review             → <MessagesReviewPage onBack onOpen />
 *   'messages-review-thread' + id     /admin/messages-review-thread/{id} → <MessagesReviewThreadPage conversationId onBack />
 *
 * Push: server route "message-thread/{id}" (PushRoutes) opens the thread in the member or trainer app.
 */
export * from './routePaths';

export { default as MessagesScreen } from './screens/MessagesScreen';
export { default as MessageThreadScreen } from './screens/MessageThreadScreen';
export { default as MessagesReviewPage } from './pages/MessagesReviewPage';
export { default as MessagesReviewThreadPage } from './pages/MessagesReviewThreadPage';
export { default as MessagesEntryCard } from './components/MessagesEntryCard';
export { useOpenConversation, useUnreadMessages } from './api/messagingQueries';
