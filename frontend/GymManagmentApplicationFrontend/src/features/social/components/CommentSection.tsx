import React, { useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import Avatar from '../../common/components/Avatar';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { useMe } from '../../auth/api/authQueries';
import { SocialComment, SocialPost } from '../api/social.types';
import { useComments, useAddComment, useUpdateComment, useDeleteComment } from '../api/socialQueries';
import { plural } from '../utils/time';
import CommentList, { CommentSkeletonRow, wrapText } from './CommentList';
import CommentInput from './CommentInput';

/** The post being discussed, shown once at the top of the list. */
function PostSummary({ post }: { post: SocialPost }) {
  if (!post.caption) return null;
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.md, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: T.line }}>
      <Avatar uri={post.user.avatarUrl} size={36} label={`${post.user.name} photo`} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 13, fontWeight: '800' }}>{post.user.name}</Text>
        <Text style={[{ color: T.textSub, fontSize: 14, lineHeight: 20, marginTop: 2 }, wrapText]}>{post.caption}</Text>
      </View>
    </View>
  );
}

/**
 * All comments of a post in a centred sheet (full width on phones, a 560px card on wider screens):
 * paged oldest-first, with add, edit and delete. A new comment scrolls into view.
 */
export default function CommentSection({ post, visible, onClose }: { post: SocialPost; visible: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  const toast = useToast();
  const me = useMe();
  const q = useComments(post.id, visible);
  const add = useAddComment(post.id);
  const update = useUpdateComment(post.id);
  const remove = useDeleteComment(post.id);
  const list = useRef<FlatList<SocialComment>>(null);
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
      add.mutate(text, {
        onSuccess: () => setTimeout(() => list.current?.scrollToEnd({ animated: true }), 120),
        onError: e => setError(apiErrorText(e)),
      });
    }
  };

  const empty = q.isPending ? (
    <View><CommentSkeletonRow /><CommentSkeletonRow /><CommentSkeletonRow /></View>
  ) : q.isError ? (
    <View style={{ padding: SP.xl, alignItems: 'center', gap: SP.md }}>
      <Feather name="wifi-off" size={26} color={T.err} />
      <Text style={{ color: T.textSub, fontSize: 14 }}>Couldn’t load comments.</Text>
      <Pressable onPress={() => q.refetch()} accessibilityRole="button" style={{ height: 40, paddingHorizontal: 20, borderRadius: R.pill, justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.14) }}>
        <Text style={{ color: T.brand, fontWeight: '800' }}>Try again</Text>
      </Pressable>
    </View>
  ) : (
    <View style={{ paddingVertical: 48, paddingHorizontal: SP.xl, alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, marginBottom: SP.md }}>
        <Feather name="message-circle" size={28} color={T.brand} />
      </View>
      <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }}>No comments yet</Text>
      <Text style={{ color: T.textSub, fontSize: 13, marginTop: 4 }}>Be the first to say something.</Text>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`Comments · ${total.toLocaleString()}`}
      style={{ height: Math.min(Math.round(height * 0.88), 760), width: '100%', maxWidth: 560, alignSelf: 'center' }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          ref={list}
          style={{ flex: 1 }}
          data={comments}
          keyExtractor={c => String(c.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <CommentList
              comments={[item]}
              editingId={editing?.id}
              onEdit={c => { setError(null); setEditing({ id: c.id, text: c.text }); }}
              onDelete={c => remove.mutate(c.id, {
                onSuccess: () => { if (editing?.id === c.id) setEditing(null); },
                onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
              })}
            />
          )}
          onEndReached={() => { if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={<PostSummary post={post} />}
          ListEmptyComponent={empty}
          ListFooterComponent={
            q.isFetchingNextPage ? <ActivityIndicator color={T.brand} style={{ margin: SP.lg }} />
            : q.hasNextPage ? (
              <Pressable onPress={() => q.fetchNextPage()} accessibilityRole="button" style={{ margin: SP.lg, height: 42, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.12) }}>
                <Text style={{ color: T.brand, fontWeight: '800', fontSize: 13 }}>Load {plural(Math.max(0, total - comments.length), 'more comment')}</Text>
              </Pressable>
            ) : <View style={{ height: SP.md }} />
          }
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
