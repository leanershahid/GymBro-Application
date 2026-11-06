import React, { useCallback, useState } from 'react';
import { FlatList, View, Text, Pressable, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import { apiErrorText } from '../../../api/apiError';
import { useAnnouncementsAdmin } from '../api/operationsQueries';
import type { AnnouncementAdmin, AnnouncementStatus } from '../types/operations.types';

interface Props {
  onBack?: () => void;
  onCompose: () => void;
  onEdit: (id: number) => void;
}

type Filter = 'all' | 'Published' | 'Scheduled' | 'Draft';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'Published', label: 'Sent' }, { key: 'Scheduled', label: 'Scheduled' }, { key: 'Draft', label: 'Drafts' },
];

const TONE: Record<AnnouncementStatus, PillTone> = {
  Draft: 'neutral', Scheduled: 'info', Publishing: 'warn', Published: 'ok', Cancelled: 'err', Expired: 'neutral',
};
const LABEL: Record<AnnouncementStatus, string> = {
  Draft: 'Draft', Scheduled: 'Scheduled', Publishing: 'Sending', Published: 'Sent', Cancelled: 'Cancelled', Expired: 'Expired',
};

const keyExtractor = (a: AnnouncementAdmin) => String(a.id);
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

/** Admin: announcements with status, audience and reach (recipients, read %). */
export default function AnnouncementsAdminPage({ onBack, onCompose, onEdit }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const q = useAnnouncementsAdmin(filter === 'all' ? undefined : filter);
  const renderItem = useCallback(({ item }: { item: AnnouncementAdmin }) => <Row a={item} onPress={onEdit} />, [onEdit]);

  return (
    <Screen>
      <ScreenHeader eyebrow="Engage" title="Announcements" onBack={onBack} action={{ label: 'New', icon: 'plus', onPress: onCompose }} />
      <SegmentedTabs tabs={FILTERS} value={filter} onChange={setFilter} style={{ marginHorizontal: SP.xl, marginBottom: SP.md }} />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }}><Skeleton rows={4} height={100} /></View>
      ) : q.isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load announcements" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
          ListEmptyComponent={
            <EmptyState icon="volume-2" title="No announcements" subtitle="Tell members about closures, events and offers. They get an in-app notification and a push."
              action={{ label: 'Write one', onPress: onCompose }} />
          }
        />
      )}
    </Screen>
  );
}

const Row = React.memo(function Row({ a, onPress }: { a: AnnouncementAdmin; onPress: (id: number) => void }) {
  const readPct = a.recipientCount > 0 ? Math.round((a.readCount / a.recipientCount) * 100) : 0;
  const when = a.status === 'Scheduled' ? `Sends ${fmt(a.publishAt)}` : a.publishedAt ? `Sent ${fmt(a.publishedAt)}` : `Created ${fmt(a.createdAt)}`;
  return (
    <Pressable
      onPress={() => onPress(a.id)}
      accessibilityRole="button"
      accessibilityLabel={`${a.title}. ${LABEL[a.status]}. ${a.audienceLabel}. ${a.recipientCount} recipients, ${a.readCount} read.`}
      style={({ pressed }) => ({ padding: SP.lg, borderRadius: R.lg, backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: T.line, gap: SP.sm })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <StatusPill label={LABEL[a.status]} tone={TONE[a.status]} dot />
        {a.isPinned && <Feather name="bookmark" size={14} color={T.brandGold} accessibilityLabel="Pinned" />}
        {a.isUrgent && <Feather name="alert-circle" size={14} color={T.err} accessibilityLabel="Urgent" />}
        <Text style={{ color: T.textFaint, fontSize: 12, marginLeft: 'auto' }} numberOfLines={1}>{when}</Text>
      </View>
      <Text numberOfLines={2} style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>{a.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.lg, flexWrap: 'wrap' }}>
        <Meta icon="users" text={a.audienceLabel} />
        {(a.status === 'Published' || a.status === 'Expired' || a.status === 'Publishing') && (
          <>
            <Meta icon="send" text={`${a.recipientCount.toLocaleString()} reached`} />
            <Meta icon="eye" text={`${a.readCount.toLocaleString()} read (${readPct}%)`} />
          </>
        )}
      </View>
      {a.recipientCount > 0 && (
        <View style={{ height: 4, borderRadius: 2, backgroundColor: withAlpha(T.brand, 0.12), overflow: 'hidden' }}
          accessibilityLabel={`${readPct}% read`}>
          <View style={{ width: `${readPct}%`, height: 4, backgroundColor: T.brand }} />
        </View>
      )}
    </Pressable>
  );
});

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Feather name={icon} size={13} color={T.textSub} />
      <Text style={{ color: T.textSub, fontSize: 13 }}>{text}</Text>
    </View>
  );
}
