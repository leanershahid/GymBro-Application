import React, { memo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { T, SP, R } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { useToast } from '../../common/components/Toast';
import { apiErrorText } from '../../../api/apiError';
import { SocialPost } from '../api/social.types';
import { useToggleLike, useDeletePost } from '../api/socialQueries';
import { timeAgo, fullDate, plural } from '../utils/time';
import PostImageGallery from './PostImageGallery';
import PostActions from './PostActions';
import PostOptionsMenu from './PostOptionsMenu';
import { CommentRow } from './CommentList';
import CommentSection from './CommentSection';

/** One post: author, photos, like/comment, caption and the latest comments. */
function SocialPostCard({ post, width }: { post: SocialPost; width: number }) {
  const toast = useToast();
  const like = useToggleLike();
  const del = useDeletePost();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => like.mutate({ postId: post.id, like: !post.likedByMe }, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) });
  const doubleTap = () => { if (!post.likedByMe) like.mutate({ postId: post.id, like: true }, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) }); };
  const caption = post.caption ?? '';
  const long = caption.length > 140 || caption.split('\n').length > 3;

  return (
    <View style={{ width, backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1, borderColor: T.line, overflow: 'hidden', marginBottom: SP.lg }}>
      {/* Author */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: SP.md, paddingVertical: 4 }}>
        <Avatar uri={post.user.avatarUrl} size={40} borderColor={T.brand} borderWidth={2} label={`${post.user.name} photo`} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: SP.md }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>{post.user.name}</Text>
          <Text accessibilityLabel={fullDate(post.createdAt)} style={{ color: T.textFaint, fontSize: 12 }}>{timeAgo(post.createdAt)}</Text>
        </View>
        <PostOptionsMenu
          title="Post"
          accessibilityLabel="Post options"
          actions={post.canDelete ? [{
            label: 'Delete post', icon: 'trash-2', destructive: true,
            confirm: { title: 'Delete post?', message: 'This post, its photos and its comments will disappear from the feed.', confirmLabel: 'Delete post' },
            onPress: () => del.mutate(post.id, {
              onSuccess: () => toast.show({ message: 'Post deleted' }),
              onError: e => toast.show({ type: 'error', message: apiErrorText(e) }),
            }),
          }] : []}
        />
      </View>

      <PostImageGallery images={post.images} caption={post.caption} onDoubleTap={doubleTap} />

      <PostActions post={post} onToggleLike={toggle} onOpenComments={() => setCommentsOpen(true)} />

      <View style={{ paddingHorizontal: SP.md + 2, paddingTop: 4, paddingBottom: SP.md, gap: 6 }}>
        {!!caption && (
          <Pressable onPress={() => long && setExpanded(e => !e)} accessibilityRole={long ? 'button' : undefined} accessibilityHint={long ? 'Shows the full caption' : undefined}>
            <Text numberOfLines={expanded ? undefined : 3} style={{ color: T.text, fontSize: 14, lineHeight: 20 }}>
              <Text style={{ fontWeight: '800' }}>{post.user.name}  </Text>{caption}
            </Text>
            {long && !expanded && <Text style={{ color: T.textFaint, fontSize: 13, marginTop: 2 }}>more</Text>}
          </Pressable>
        )}

        {post.commentCount > 2 && (
          <Pressable onPress={() => setCommentsOpen(true)} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: T.textSub, fontSize: 13 }}>View all {plural(post.commentCount, 'comment')}</Text>
          </Pressable>
        )}
        {post.commentsPreview.map(c => <CommentRow key={c.id} comment={c} compact />)}

        <Pressable onPress={() => setCommentsOpen(true)} accessibilityRole="button" accessibilityLabel="Add a comment" hitSlop={6}>
          <Text style={{ color: T.textFaint, fontSize: 13 }}>Add a comment…</Text>
        </Pressable>
      </View>

      {commentsOpen && <CommentSection post={post} visible={commentsOpen} onClose={() => setCommentsOpen(false)} />}
    </View>
  );
}

export default memo(SocialPostCard);
