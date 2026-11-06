/**
 * Screens of the safety feature (waivers, health check, emergency contact, consents) for the
 * area routers to wire. Everything here is self-contained: none of it needs a router to work
 * (the Home card, Profile section and booking gate open the flow in a modal by default).
 *
 * Member area (memberRoutes.ts / MemberApp.tsx):
 *   { id: 'safety'; step?: SafetyStep }   path: /member/safety[/waiver|health|emergency]
 *   → <SafetyFlowScreen start={step} onClose={back} />
 *   Mount once:  <SafetyGateHost />  (opens the flow on SAFETY_REQUIRED from booking / check-in).
 *   Home:        <GetStartedCard onOpenStep={step => go({ id: 'safety', step })} />  (or no prop = modal)
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), module `admin.waivers` (route key 'waivers'):
 *   { id: 'waivers' }   path: /admin/waivers   → <WaiverSettingsPage onBack={back} />
 */
import type { SafetyStep } from './api/safety.types';

export const SAFETY_STEPS: readonly SafetyStep[] = ['waiver', 'health', 'emergency'];

export const isSafetyStep = (s: string | undefined): s is SafetyStep => !!s && (SAFETY_STEPS as readonly string[]).includes(s);

/** Member route: /member/safety[/step]. */
export type SafetyMemberRoute = { id: 'safety'; step?: SafetyStep };

export function safetyRouteFromPath([id, step]: readonly string[]): SafetyMemberRoute | null {
  if (id !== 'safety') return null;
  return isSafetyStep(step) ? { id, step } : { id };
}

export const safetyRouteToPath = (r: SafetyMemberRoute): string[] => (r.step ? ['safety', r.step] : ['safety']);

/** Admin route key (matches ModuleCatalog `admin.waivers` → Route "waivers"). */
export const WAIVERS_ADMIN_ROUTE = 'waivers' as const;

export { default as SafetyFlowScreen } from './screens/SafetyFlowScreen';
export { default as WaiverSettingsPage } from './pages/WaiverSettingsPage';
export { default as GetStartedCard } from './components/GetStartedCard';
export { default as SafetyGateHost, SafetyFlowModal } from './components/SafetyGateHost';
export { default as SafetyProfileSection } from './components/SafetyProfileSection';
export { default as MemberSafetySection } from './components/MemberSafetySection';
export { handleSafetyGateError, isSafetyGateError, openSafetyFlow, safetyGateFrom } from './utils/safetyGate';
