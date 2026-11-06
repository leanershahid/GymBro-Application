/**
 * Cancellation & no-show rules (roadmap feature 9).
 *
 * Admin area (adminRoutes.ts / AdminRouter.tsx), owned by the `classes` module (edit rights):
 *   { screen: 'booking-rules' }   path: /admin/booking-rules   → <BookingRulesPage onBack={…} />
 *   (opened from Class schedule → "Booking rules")
 *
 * Embedded pieces (no route):
 *   member-booking:  <BookingStandingCard /> (My bookings), <LateCancelSheet />, cancelRuleText(),
 *                    lateCancelFrom() / bookingBlockedFrom() for the 409 / 422 codes.
 *   classes:         <PenaltyList filter={{ classId }} /> (roster), {{ ptSessionId }} (PT session sheet).
 *   members:         <MemberBookingsSection memberId /> (member detail).
 * Push route "my-bookings" (PushRoutes "booking_penalty") opens the member's Book → My bookings tab.
 */
export const BOOKING_RULES_ADMIN_ROUTE = 'booking-rules' as const;

export { default as BookingRulesPage } from './pages/BookingRulesPage';
export { default as BookingStandingCard } from './components/BookingStandingCard';
export { default as LateCancelSheet } from './components/LateCancelSheet';
export { default as PenaltyList } from './components/PenaltyList';
export { default as MemberBookingsSection } from './components/MemberBookingsSection';
export { useBookingPolicy, useMyStanding, bookingRulesKeys } from './api/bookingRulesQueries';
export {
  cancelRuleText, lateCancelFromPolicy, lateCancelFrom, bookingBlockedFrom, lateCancelText, shortWhen, longDay, utc as parseRuleTime,
} from './utils/bookingRulesFormat';
export type { LateCancelInfo, BookingPolicy } from './types/bookingRules.types';
