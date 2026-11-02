import React, { useCallback, useMemo } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl, Text, Pressable, useWindowDimensions } from 'react-native';
import { T, SP } from '../../../theme';
import { SocialPost } from '../api/social.types';
import { useFeed } from '../api/socialQueries';
import SocialPostCard from './SocialPostCard';
import PostSkeleton from './PostSkeleton';
import SocialEmptyState from './SocialEmptyState';

/** Instagram-like column: full width on phones, a centred 560px column on tablets and desktops. */
export function useFeedWidth(hPad: number) {
  const { width } = useWindowDimensions();
  return Math.min(560, width - hPad * 2);
}

/** The feed: newest first, endless scrolling by cursor, pull to refresh. */
export default function SocialFeed({ onCreate, header }: { onCreate: () => void; header?: React.ReactElement }) {
  const hPad = SP.lg;
  const w = useFeedWidth(hPad);
  const q = useFeed();

  const posts = useMemo<SocialPost[]>(() => {
    const seen = new Set<number>();
    return (q.data?.pages.flatMap(p => p.items) ?? []).filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [q.data]);

  const render = useCallback(({ item }: { item: SocialPost }) => <SocialPostCard post={item} width={w} />, [w]);

  return (
    <FlatList
      data={posts}
      keyExtractor={p => String(p.id)}
      renderItem={render}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 120, alignItems: 'center' }}
      showsVerticalScrollIndicator={false}
      onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => q.refetch()} tintColor={T.brand} colors={[T.brand]} />}
      initialNumToRender={3}
      windowSize={7}
      removeClippedSubviews
      ListEmptyComponent={
        q.isPending ? (
          <View style={{ width: w }}><PostSkeleton width={w} /><PostSkeleton width={w} /></View>
        ) : q.isError ? (
          <SocialEmptyState kind="error" onRetry={() => q.refetch()} message={q.error instanceof Error ? q.error.message : undefined} />
        ) : (
          <SocialEmptyState kind="feed" onCreate={onCreate} />
        )
      }
      ListFooterComponent={
        q.isFetchingNextPage ? <ActivityIndicator color={T.brand} style={{ margin: SP.xl }} />
        : q.isFetchNextPageError ? (
          <Pressable onPress={() => q.fetchNextPage()} accessibilityRole="button" style={{ padding: SP.lg }}>
            <Text style={{ color: T.brand, fontWeight: '700' }}>Couldn’t load more · Try again</Text>
          </Pressable>
        ) : posts.length > 0 && !q.hasNextPage ? (
          <Text style={{ color: T.textFaint, fontSize: 13, textAlign: 'center', margin: SP.xl }}>You’re all caught up</Text>
        ) : null
      }
    />
  );
}
