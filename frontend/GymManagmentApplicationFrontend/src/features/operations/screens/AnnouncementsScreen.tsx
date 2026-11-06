import React, { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, View, Pressable, Text } from 'react-native';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import EmptyState from '../../common/components/EmptyState';
import Skeleton from '../../common/components/Skeleton';
import { apiErrorText } from '../../../api/apiError';
import { useAnnouncementFeed, useMarkAnnouncementRead } from '../api/operationsQueries';
import type { AnnouncementItem } from '../types/operations.types';
import AnnouncementRow from '../components/AnnouncementRow';

interface Props {
  onBack?: () => void;
  /** Opens one announcement (route `announcements/{id}`). */
  onOpen: (id: number) => void;
}

const keyExtractor = (a: AnnouncementItem) => String(a.id);

/** Member / trainer feed: pinned on top, newest first, unread dots, "mark all read". */
export default function AnnouncementsScreen({ onBack, onOpen }: Props) {
  const q = useAnnouncementFeed();
  const markAll = useMarkAnnouncementRead();
  const items = useMemo(() => q.data?.pages.flatMap(p => p.items) ?? [], [q.data]);
  const unread = q.data?.pages[0]?.unreadCount ?? 0;

  const renderItem = useCallback(({ item }: { item: AnnouncementItem }) => <AnnouncementRow item={item} onPress={onOpen} />, [onOpen]);

  return (
    <Screen>
      <ScreenHeader
        eyebrow={unread > 0 ? `${unread} unread` : 'Your gym'}
        title="Announcements"
        onBack={onBack}
        action={unread > 0 ? { label: 'Mark all read', icon: 'check', onPress: () => markAll.mutate(null) } : undefined}
      />
      {q.isLoading ? (
        <View style={{ paddingHorizontal: SP.xl }} accessibilityLabel="Loading announcements">
          <Skeleton rows={4} height={96} borderRadius={16} gap={SP.md} />
        </View>
      ) : q.isError ? (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load announcements" subtitle={apiErrorText(q.error)}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 110, gap: SP.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} tintColor={T.brand} />}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState icon="volume-2" title="No announcements yet" subtitle="News from your gym (closures, events, offers) will show up here." />
          }
          ListFooterComponent={q.hasNextPage ? (
            <Pressable onPress={() => q.fetchNextPage()} accessibilityRole="button" accessibilityLabel="Load older announcements"
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '600' }}>{q.isFetchingNextPage ? 'Loading…' : 'Load older'}</Text>
            </Pressable>
          ) : null}
        />
      )}
    </Screen>
  );
}
