import { Alert, Platform } from 'react-native';

/**
 * Cross-platform dialogs (ARCH-063).
 *
 * `Alert.alert` works on iOS/Android, but react-native-web ships it as a no-op and the
 * old window.confirm shim only offered OK/Cancel (wrong labels, only the first action
 * selectable). Use these helpers instead of `Alert.alert` everywhere:
 *
 *   showAlert(title, message?, buttons?)  — drop-in for Alert.alert (any number of buttons)
 *   await confirm({ title, message, confirmLabel, destructive })  → boolean
 *   await notify(title, message?)        — single "OK" message
 *
 * Native uses the platform Alert. Web renders <DialogHost/> (mounted once in App.tsx);
 * if no host is mounted it falls back to Alert.alert (the browser shim).
 */

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text?: string;
  onPress?: () => void;
  style?: DialogButtonStyle;
}

export interface DialogOptions {
  /** Android: tapping outside dismisses (treated as cancel). Default true on web. */
  cancelable?: boolean;
}

export interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  cancelable: boolean;
}

type HostListener = (request: DialogRequest) => void;

let hostListener: HostListener | null = null;
let nextId = 0;

/** Internal: DialogHost registers itself here. Returns an unregister function. */
export function registerDialogHost(listener: HostListener): () => void {
  hostListener = listener;
  return () => {
    if (hostListener === listener) hostListener = null;
  };
}

/** Drop-in replacement for `Alert.alert(title, message, buttons, options)` that works on web. */
export function showAlert(title: string, message?: string, buttons?: DialogButton[], options?: DialogOptions): void {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web' || !hostListener) {
    Alert.alert(title, message, list, options);
    return;
  }
  hostListener({ id: ++nextId, title, message, buttons: list, cancelable: options?.cancelable ?? true });
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the confirming button. Default "OK". */
  confirmLabel?: string;
  /** Label of the cancel button. Default "Cancel". */
  cancelLabel?: string;
  /** Styles the confirming button as destructive (red). */
  destructive?: boolean;
}

/** Ask a yes/no question. Resolves true when the confirming button is pressed. */
export function confirm({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive }: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    showAlert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true },
    );
  });
}

/** Show a message with a single OK button. Resolves when it is dismissed. */
export function notify(title: string, message?: string, okLabel = 'OK'): Promise<void> {
  return new Promise(resolve => {
    showAlert(title, message, [{ text: okLabel, onPress: () => resolve() }]);
  });
}
