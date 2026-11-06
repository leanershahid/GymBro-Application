import React, { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { R, SP, T, TY, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { apiErrorText } from '../../../api/apiError';
import { useMarkNotificationRead, useNotifications } from '../api/notificationsQueries';
import PushPermissionCard from '../components/PushPermissionCard';
import { emitNotificationOpen } from '../push/openHandlers';
import type { AppNotification } from '../types/notifications.types';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const ICONS: Record<string, FeatherName> = {
  booking: 'calendar', class_reminder: 'calendar', waitlist: 'zap', waitlist_offer: 'zap',
  pt: 'user-check', pt_reminder: 'user-check', billing: 'credit-card', training: 'activity', health: 'heart',
};

const keyExtractor = (n: AppNotification) => String(n.id);

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const Row = React.memo(function Row({ item, onPress }: { item: AppNotification; onPress: (n: AppNotification) => void }) {
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.body ?? ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', padding: SP.lg, marginHorizontal: SP.xl, marginBottom: SP.md,
        borderRadius: R.lg, minHeight: 64, opacity: pressed ? 0.7 : 1,
        backgroundColor: item.isRead ? T.bgInput : T.bgInputActive,
        borderWidth: 1, borderColor: item.isRead ? T.line : withAlpha(T.brand, 0.25),
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: R.full, backgroundColor: withAlpha(T.brand, 0.12), alignItems: 'center', justifyContent: 'center', marginRight: SP.md }}>
        <Feather name={ICONS[item.kind ?? ''] ?? 'bell'} size={18} color={T.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...TY.base, color: T.text, fontWeight: item.isRead ? '500' : '700' }}>{item.title}</Text>
        {!!item.body && <Text style={{ ...TY.sm, color: T.textSub, marginTop: 2 }}>{item.body}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: SP.sm }}>
        <Text style={{ ...TY.xs, color: T.textFaint }}>{ago(item.createdAt)}</Text>
        {!item.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.brand, marginTop: SP.sm }} />}
      </View>
    </Pressable>
  );
});

interface Props {
  userId: number;
  onBack?: () => void;
  /** Opens Settings → Notifications. */
  onOpenSettings?: () => void;
}

/**
 * Alerts list (GET /notifications). Tapping a row marks it read and goes through the same
 * `onNotificationOpen` handlers as a tapped push, so both open the same screen.
 */
export default function NotificationsScreen({ userId, onBack, onOpenSettings }: Props) {
  const list = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);

  const open = useCallback((n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    emitNotificationOpen({ kind: n.kind, refId: n.refId, route: n.route });
  }, [markRead]);
  const renderItem = useCallback(({ item }: { item: AppNotification }) => <Row item={item} onPress={open} />, [open]);

  const unread = list.data?.unread ?? 0;
  return (
    <Screen>
      <ScreenHeader
        title="Alerts"
        eyebrow={unread > 0 ? `${unread} unread` : undefined}
        onBack={onBack}
        action={unread > 0 ? { label: 'Mark all read', icon: 'check', onPress: () => markRead.mutate(null) }
          : onOpenSettings ? { label: 'Settings', icon: 'settings', onPress: onOpenSettings } : undefined}
      />
      {list.isLoading ? <LoadingState /> : list.isError ? (
        <EmptyState icon="alert-circle" tone="error" title="Couldn't load alerts" subtitle={apiErrorText(list.error)}
          action={{ label: 'Try again', onPress: () => void list.refetch() }} />
      ) : (
        <FlatList
          data={list.data?.items ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={<PushPermissionCard />}
          ListEmptyComponent={<EmptyState icon="bell" title="You're all caught up" subtitle="Class reminders, waitlist spots and billing updates show up here." />}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={T.brand} />}
          contentContainerStyle={{ paddingBottom: SP.xxl * 2 }}
        />
      )}
    </Screen>
  );
}
