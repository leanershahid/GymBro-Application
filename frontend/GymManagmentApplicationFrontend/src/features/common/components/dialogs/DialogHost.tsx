import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { T, SP, R, TY, withAlpha, Shadow } from '../../../../theme';
import { DialogButton, DialogRequest, registerDialogHost } from './dialogs';

/**
 * Renders showAlert/confirm/notify dialogs on web (native uses the platform Alert).
 * Mount once near the app root. Requests queue, so two alerts never overwrite each other.
 */
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return registerDialogHost(req => setQueue(q => [...q, req]));
  }, []);

  const current = queue[0];

  const close = useCallback((button?: DialogButton) => {
    setQueue(q => q.slice(1));
    // Run the handler after the dialog is gone, like the native Alert does.
    if (button?.onPress) setTimeout(button.onPress, 0);
  }, []);

  if (!current) return null;

  const cancel = current.buttons.find(b => b.style === 'cancel');
  const dismiss = () => { if (current.cancelable) close(cancel); };
  // Cancel first (left), then the actions in the order given — mirrors iOS.
  const ordered = [...current.buttons.filter(b => b.style === 'cancel'), ...current.buttons.filter(b => b.style !== 'cancel')];
  const stacked = ordered.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={{ flex: 1, backgroundColor: withAlpha(T.black, 0.6), alignItems: 'center', justifyContent: 'center', padding: SP.lg }}
      >
        <Pressable
          onPress={() => {}}
          accessibilityRole="alert"
          style={[{ width: '100%', maxWidth: 400, backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, gap: SP.md }, Shadow.card]}
        >
          <Text style={{ ...TY.lg, color: T.text, fontWeight: '700' }}>{current.title}</Text>
          {!!current.message && <Text style={{ ...TY.base, color: T.textSub }}>{current.message}</Text>}
          <View style={{ flexDirection: stacked ? 'column' : 'row', justifyContent: 'flex-end', gap: SP.sm, marginTop: SP.xs }}>
            {ordered.map((b, i) => {
              const color = b.style === 'destructive' ? T.err : b.style === 'cancel' ? T.textSub : T.brand;
              return (
                <Pressable
                  key={`${b.text ?? 'OK'}-${i}`}
                  onPress={() => close(b)}
                  accessibilityRole="button"
                  accessibilityLabel={b.text ?? 'OK'}
                  style={({ pressed }) => ({
                    minHeight: 44, paddingHorizontal: SP.lg, borderRadius: R.md, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: pressed ? T.bgInputActive : 'transparent',
                  })}
                >
                  <Text style={{ ...TY.base, color, fontWeight: b.style === 'cancel' ? '400' : '700' }}>{b.text ?? 'OK'}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
