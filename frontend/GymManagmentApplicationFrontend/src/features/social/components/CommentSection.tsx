import React, { useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { T, SP } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import Skeleton from '../../common/components/Skeleton';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useMe } from '../../auth/api/authQueries';
import { SocialComment, SocialPost } from '../api/social.types';
import { useComments, useAddComment, useUpdateComment, useDeleteComment } from '../api/socialQueries';
import { plural } from '../utils/time';
import CommentList from './CommentList';
import CommentInput from './CommentInput';

/** All comments of a post in a sheet: paged oldest-first, with add, edit and delete. */
export default function CommentSection({ post, visible, onClose }: { post: SocialPost; visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const toast = useToast();
  const me = useMe();
  const q = useComments(post.id, visible);
  const add = useAddComment(post.id);
  const update = useUpdateComment(post.id);
  const remove = useDeleteComment(post.id);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const comments: SocialComment[] = q.data?.pages.flatMap(p => p.items) ?? [];
  const total = q.data?.pages[0]?.totalRecords ?? post.commentCount;

  const submit = (text: string) => {
    setError(null);
    if (editing) {
      update.mutate({ commentId: editing.id, text }, {
        onSuccess: () => setEditing(null),
        onError: e => setError(apiErrorText(e)),
      });
    } else {
      add.mutate(text, { onError: e => setError(apiErrorText(e)) });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Comments · ${total.toLocaleString()}`} style={{ height: Math.round(height * 0.86) }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={comments}
          keyExtractor={c => String(c.id)}
          renderItem={({ item }) => (
            <CommentList
              comments={[item]}
              onEdit={c => { setError(null); setEditing({ id: c.id, text: c.text }); }}
              onDelete={c => remove.mutate(c.id, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) })}
            />
          )}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={post.caption ? (
            <View style={{ paddingHorizontal: SP.lg, paddingVertical: SP.md, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ color: T.text, fontSize: 14, lineHeight: 20 }}><Text style={{ fontWeight: '800' }}>{post.user.name}  </Text>{post.caption}</Text>
            </View>
          ) : null}
          ListEmptyComponent={q.isPending ? (
            <View style={{ padding: SP.lg }}><Skeleton rows={4} height={44} borderRadius={12} gap={10} /></View>
          ) : q.isError ? (
            <View style={{ padding: SP.xl, alignItems: 'center', gap: SP.sm }}>
              <Text style={{ color: T.textSub, fontSize: 14 }}>Couldn’t load comments.</Text>
              <Pressable onPress={() => q.refetch()} accessibilityRole="button"><Text style={{ color: T.brand, fontWeight: '700' }}>Try again</Text></Pressable>
            </View>
          ) : (
            <View style={{ padding: SP.xl, alignItems: 'center' }}>
              <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>No comments yet</Text>
              <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>Start the conversation.</Text>
            </View>
          )}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={T.brand} style={{ margin: SP.lg }} /> : q.hasNextPage ? (
            <Pressable onPress={() => q.fetchNextPage()} accessibilityRole="button" style={{ padding: SP.lg, alignItems: 'center' }}>
              <Text style={{ color: T.brand, fontWeight: '700' }}>Load more · {plural(total - comments.length, 'comment')} left</Text>
            </Pressable>
          ) : null}
        />
        <CommentInput
          myAvatar={me.data?.avatarUrl}
          editing={editing}
          busy={add.isPending || update.isPending}
          error={error}
          onSubmit={submit}
          onCancelEdit={() => { setEditing(null); setError(null); }}
        />
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}
