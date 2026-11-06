import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { R, SP, T, TY, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { notify } from '../../common/components/dialogs';
import { getPushPermission, requestPushPermission, type PushPermission } from '../push/pushNotifications';
import { isExplainerSnoozed, snoozeExplainer } from '../push/explainerStore';

interface Props {
  /** Show even when snoozed (e.g. on the notification settings screen). */
  ignoreSnooze?: boolean;
  /** Called with the permission after the user answers. */
  onResult?: (permission: PushPermission) => void;
  /** No outer margins (the parent already pads / gaps its children). */
  flush?: boolean;
}

/**
 * Pre-permission explainer: says what notifications are for before the OS prompt appears, so the
 * one-time system dialog is only shown to people who want it. Renders nothing on web, in Expo Go
 * on Android, once permission was granted/denied, or for 14 days after "Not now".
 */
export default function PushPermissionCard({ ignoreSnooze = false, onResult, flush = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const permission = await getPushPermission();
      const snoozed = ignoreSnooze ? false : await isExplainerSnoozed();
      if (alive) setVisible(permission === 'undetermined' && !snoozed);
    })();
    return () => { alive = false; };
  }, [ignoreSnooze]);

  if (!visible) return null;

  const turnOn = async () => {
    setBusy(true);
    const result = await requestPushPermission();
    setBusy(false);
    setVisible(false);
    onResult?.(result);
    if (result === 'denied')
      void notify('Notifications are off', 'You can turn them on any time in your phone’s Settings → GymBro → Notifications.');
  };

  const notNow = async () => {
    await snoozeExplainer();
    setVisible(false);
  };

  return (
    <View
      style={{
        marginHorizontal: flush ? 0 : SP.xl, marginBottom: flush ? 0 : SP.xl, padding: SP.lg, borderRadius: R.xl,
        backgroundColor: T.bgInput, borderWidth: 1, borderColor: withAlpha(T.brand, 0.25),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.md }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: R.full, alignItems: 'center', justifyContent: 'center',
            backgroundColor: withAlpha(T.brand, 0.12), marginRight: SP.md,
          }}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Feather name="bell" size={22} color={T.brand} />
        </View>
        <Text accessibilityRole="header" style={{ ...TY.lg, color: T.text, fontWeight: '700', flex: 1 }}>
          Never miss a class
        </Text>
      </View>
      <Text style={{ ...TY.sm, color: T.textSub, marginBottom: SP.lg }}>
        Get reminders 2 hours before your class or PT session, and a heads-up the moment a waitlist spot opens up for you.
        You choose what you get in Settings → Notifications.
      </Text>
      <PrimaryButton
        label="Turn on notifications"
        icon="bell"
        onPress={turnOn}
        loading={busy}
        accessibilityHint="Shows your phone's permission prompt for GymBro notifications"
      />
      <Pressable
        onPress={notNow}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        accessibilityHint="Hides this card. You can turn notifications on later in Settings."
        hitSlop={8}
        style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: SP.sm, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ ...TY.base, color: T.textSub, fontWeight: '600' }}>Not now</Text>
      </Pressable>
    </View>
  );
}
