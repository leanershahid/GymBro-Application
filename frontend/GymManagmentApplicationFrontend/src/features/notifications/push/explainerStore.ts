import { prefsStore } from '../../../utils/storage';

// "Not now" on the pre-permission card hides it for a while instead of forever.
const KEY = 'gymbro.push.explainer_dismissed_at';
const SNOOZE_MS = 14 * 86_400_000;

export async function isExplainerSnoozed(): Promise<boolean> {
  try {
    const at = Number(await prefsStore.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export async function snoozeExplainer(): Promise<void> {
  try { await prefsStore.setItem(KEY, String(Date.now())); } catch { /* storage unavailable */ }
}
