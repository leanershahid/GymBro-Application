import { showAlert } from '../../common/components/dialogs';
import { bookingBlockedFrom, longDay, parseRuleTime } from '../../booking-rules/routes';

/**
 * 422 BOOKING_BLOCKED (repeated no-shows): explains until when, with "Contact the gym".
 * Returns true when it handled the error. Use next to handleSafetyGateError in booking handlers.
 */
export function handleBookingBlocked(e: unknown, onContactGym?: () => void): boolean {
  const info = bookingBlockedFrom(e);
  if (!info) return false;
  const until = parseRuleTime(info.until);
  showAlert(
    until ? `Booking paused until ${longDay(until)}` : 'Booking paused',
    info.message,
    onContactGym ? [{ text: 'OK', style: 'cancel' }, { text: 'Contact the gym', onPress: onContactGym }] : undefined,
  );
  return true;
}
