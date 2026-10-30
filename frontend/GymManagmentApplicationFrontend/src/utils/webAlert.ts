import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * react-native-web ships `Alert.alert` as an empty function, so every confirmation
 * (sign out, delete, deactivate…) silently did nothing on web. Install a browser
 * implementation once at startup: one button → window.alert, otherwise window.confirm
 * with OK = the first non-cancel button and Cancel = the cancel button.
 */
export function installWebAlert() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const actions = (buttons ?? []).filter(b => b.style !== 'cancel');
    const cancel = (buttons ?? []).find(b => b.style === 'cancel');

    if (actions.length === 0 || (!cancel && actions.length === 1)) {
      window.alert(text);
      (actions[0] ?? cancel)?.onPress?.();
      return;
    }
    if (window.confirm(text)) actions[0].onPress?.();
    else cancel?.onPress?.();
  };
}
