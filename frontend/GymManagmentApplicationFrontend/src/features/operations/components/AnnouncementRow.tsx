import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import type { AnnouncementItem } from '../types/operations.types';
import { relativeTime } from '../utils/hours';

/** One announcement in the feed: unread dot, pinned / urgent marks, two-line preview. */
function AnnouncementRow({ item, onPress }: { item: AnnouncementItem; onPress: (id: number) => void }) {
  const preview = item.body.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.isUrgent ? 'Urgent. ' : ''}${item.isPinned ? 'Pinned. ' : ''}${item.title}. ${relativeTime(item.publishedAt)}`}
      accessibilityHint="Opens the announcement"
      style={({ pressed }) => ({
        flexDirection: 'row', gap: SP.md, padding: SP.lg, borderRadius: R.lg,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderWidth: 1, borderColor: item.isUrgent && !item.isRead ? withAlpha(T.err, 0.35) : T.line,
      })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: T.bgInputActive }} accessibilityIgnoresInvertColors />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: withAlpha(item.isUrgent ? T.err : T.brand, 0.12), alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={item.isUrgent ? 'alert-circle' : 'volume-2'} size={18} color={item.isUrgent ? T.err : T.brand} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.isPinned && <Feather name="bookmark" size={12} color={T.brandGold} accessibilityElementsHidden />}
          {item.isUrgent && <Text style={{ color: T.err, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>URGENT</Text>}
          <Text style={{ color: T.textFaint, fontSize: 12, marginLeft: 'auto' }}>{relativeTime(item.publishedAt)}</Text>
          {!item.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.brand }} />}
        </View>
        <Text numberOfLines={2} style={{ color: T.text, fontSize: 15, fontWeight: item.isRead ? '600' : '800', marginTop: 4 }}>{item.title}</Text>
        <Text numberOfLines={2} style={{ color: T.textSub, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{preview}</Text>
      </View>
    </Pressable>
  );
}

export default React.memo(AnnouncementRow);
