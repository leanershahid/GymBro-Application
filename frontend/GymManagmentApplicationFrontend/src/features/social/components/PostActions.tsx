import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import { SocialPost } from '../api/social.types';
import { plural } from '../utils/time';
import LikeButton from './LikeButton';

interface Props {
  post: SocialPost;
  onToggleLike: () => void;
  onOpenComments: () => void;
}

/** Like and comment buttons with the counts underneath. */
export default function PostActions({ post, onToggleLike, onOpenComments }: Props) {
  return (
    <View style={{ paddingHorizontal: SP.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <LikeButton liked={post.likedByMe} onPress={onToggleLike} />
        <Pressable
          onPress={onOpenComments}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${post.commentCount}`}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="message-circle" size={24} color={T.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: SP.sm, paddingBottom: 2 }}>
        <Text accessibilityLiveRegion="polite" style={{ color: T.text, fontSize: 14, fontWeight: '800' }}>
          {plural(post.likeCount, 'like')}
        </Text>
      </View>
    </View>
  );
}
