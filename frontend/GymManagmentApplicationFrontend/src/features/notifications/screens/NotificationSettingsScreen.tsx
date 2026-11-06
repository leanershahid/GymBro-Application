import React, { useCallback } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { R, SP, T, TY } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import ChipSelect from '../../common/components/ChipSelect';
import { SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../api/notificationsQueries';
import PushPermissionCard from '../components/PushPermissionCard';
import { isPushSupported } from '../push/pushNotifications';
import type { CategoryPreference, NotificationCategory, UpdateNotificationPreferences } from '../types/notifications.types';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** Display copy per category, grouped as the screen shows them. */
const GROUPS: { title: string; items: { category: NotificationCategory; label: string; description: string; icon: FeatherName }[] }[] = [
  {
    title: 'Bookings',
    items: [
      { category: 'class_reminders', label: 'Class reminders', description: '24 hours and 2 hours before a class, and if a class is cancelled.', icon: 'calendar' },
      { category: 'pt_reminders', label: 'Personal training', description: 'Session reminders and when your trainer confirms or changes a session.', icon: 'user-check' },
      { category: 'waitlist', label: 'Waitlist', description: 'When a spot opens up for you — some offers must be claimed within a time limit.', icon: 'zap' },
    ],
  },
  {
    title: 'Account',
    items: [
      { category: 'billing', label: 'Billing', description: 'New invoices, payment receipts and membership renewals.', icon: 'credit-card' },
      { category: 'announcements', label: 'Gym announcements', description: 'Closures, holiday hours and news from your gym.', icon: 'volume-2' },
      { category: 'messages', label: 'Messages', description: 'New messages from your coach or clients. Quiet hours apply.', icon: 'message-circle' },
    ],
  },
  {
    title: 'Offers',
    items: [
      { category: 'marketing', label: 'Offers & promotions', description: 'Discounts, new classes and events. Off unless you turn it on.', icon: 'gift' },
    ],
  },
];

const START_OPTIONS = ['20:00', '21:00', '22:00', '23:00'].map(v => ({ value: v, label: v }));
const END_OPTIONS = ['06:00', '07:00', '08:00', '09:00'].map(v => ({ value: v, label: v }));

interface Props {
  userId: number;
  onBack?: () => void;
}

/** Settings → Notifications: per-category push / email switches and quiet hours. */
export default function NotificationSettingsScreen({ userId, onBack }: Props) {
  const prefs = useNotificationPreferences(userId);
  const save = useUpdateNotificationPreferences(userId);
  const toast = useToast();
  const pushOnPhone = isPushSupported();

  const update = useCallback((body: UpdateNotificationPreferences) => {
    save.mutate(body, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) });
  }, [save, toast]);

  const setChannel = (current: CategoryPreference, channel: 'push' | 'email', value: boolean) =>
    update({ categories: [{ ...current, [channel]: value }] });

  if (prefs.isLoading) return <Screen><ScreenHeader title="Notifications" eyebrow="Settings" onBack={onBack} /><LoadingState /></Screen>;
  if (prefs.isError || !prefs.data)
    return (
      <Screen>
        <ScreenHeader title="Notifications" eyebrow="Settings" onBack={onBack} />
        <EmptyState icon="alert-circle" tone="error" title="Couldn't load your settings" subtitle={apiErrorText(prefs.error)}
          action={{ label: 'Try again', onPress: () => void prefs.refetch() }} />
      </Screen>
    );

  // Optimistic view: show the switch the user just flipped while the save is in flight.
  const data = save.isPending && save.variables?.categories
    ? { ...prefs.data, categories: prefs.data.categories.map(c => save.variables!.categories!.find(v => v.category === c.category) ?? c) }
    : prefs.data;
  const byCategory = new Map(data.categories.map(c => [c.category, c]));

  return (
    <Screen>
      <ScreenHeader title="Notifications" eyebrow="Settings" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: SP.xxl * 2 }}>
        <PushPermissionCard ignoreSnooze onResult={() => void prefs.refetch()} />

        {!pushOnPhone && (
          <Text style={{ ...TY.sm, color: T.textFaint, marginHorizontal: SP.xl, marginBottom: SP.lg }}>
            Push notifications need the GymBro phone app. Here you'll still see everything in Alerts, and the email switches apply everywhere.
          </Text>
        )}

        {GROUPS.map(group => (
          <View key={group.title} style={{ marginHorizontal: SP.xl, marginBottom: SP.xl }}>
            <Text accessibilityRole="header" style={{ ...TY.label, color: T.textSub, marginBottom: SP.sm }}>{group.title}</Text>
            {group.items.map(item => {
              const pref = byCategory.get(item.category);
              if (!pref) return null;
              return (
                <View key={item.category}
                  style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, marginBottom: SP.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.xs }}>
                    <Feather name={item.icon} size={18} color={T.text} style={{ marginRight: SP.sm }} />
                    <Text style={{ ...TY.base, color: T.text, fontWeight: '700', flex: 1 }}>{item.label}</Text>
                  </View>
                  <Text style={{ ...TY.sm, color: T.textSub, marginBottom: SP.sm }}>{item.description}</Text>
                  <ChannelSwitch label="Push" category={item.label} value={pref.push} onChange={v => setChannel(pref, 'push', v)} />
                  <ChannelSwitch label="Email" category={item.label} value={pref.email} onChange={v => setChannel(pref, 'email', v)} />
                </View>
              );
            })}
          </View>
        ))}

        <View style={{ marginHorizontal: SP.xl }}>
          <Text accessibilityRole="header" style={{ ...TY.label, color: T.textSub, marginBottom: SP.sm }}>Quiet hours</Text>
          <SwitchRow
            label="Pause push notifications at night"
            description={`Held until quiet hours end (${data.timeZone}). Urgent alerts, like a class cancelled today or a spot you must claim, still come through.`}
            value={data.quietHoursEnabled}
            onValueChange={v => update({ quietHoursEnabled: v })}
          />
          {data.quietHoursEnabled && (
            <>
              <ChipSelect label="From" options={START_OPTIONS} value={data.quietStart} onChange={v => update({ quietStart: v })} />
              <ChipSelect label="Until" options={END_OPTIONS} value={data.quietEnd} onChange={v => update({ quietEnd: v })} />
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

/** One channel switch: a 48 px row whose whole surface toggles; announced as "Push for Class reminders". */
function ChannelSwitch({ label, category, value, onChange }: { label: string; category: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={`${label} for ${category}`}
      accessibilityState={{ checked: value }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onChange(!value)}
    >
      <Text style={{ ...TY.base, color: value ? T.text : T.textSub }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: T.line, true: T.brand }}
        thumbColor={value ? T.onBrand : T.text}
        ios_backgroundColor={T.line}
      />
    </View>
  );
}
