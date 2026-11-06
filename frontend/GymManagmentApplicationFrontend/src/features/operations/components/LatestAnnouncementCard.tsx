import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { useLatestUnreadAnnouncement, useUnreadAnnouncements } from '../api/operationsQueries';
import { relativeTime } from '../utils/hours';

interface Props {
  /** Opens the announcement (marks it read). */
  onOpen: (id: number) => void;
  /** Opens the announcements feed. */
  onSeeAll?: () => void;
}

/** Home card for the newest unread announcement (urgent first). Renders nothing when all are read. */
export default function LatestAnnouncementCard({ onOpen, onSeeAll }: Props) {
  const { data: item } = useLatestUnreadAnnouncement();
  const { data: unread = 0 } = useUnreadAnnouncements();
  if (!item) return null;
  const accent = item.isUrgent ? T.err : T.brand;
  const preview = item.body.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  return (
    <View style={{ borderRadius: R.xl, overflow: 'hidden', backgroundColor: T.bgInput, borderWidth: 1, borderColor: withAlpha(accent, 0.3) }}>
      <Pressable
        onPress={() => onOpen(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.isUrgent ? 'Urgent announcement' : 'New announcement'}: ${item.title}`}
        accessibilityHint="Opens the announcement"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={{ width: '100%', aspectRatio: 2.4, backgroundColor: T.bgInputActive }} accessibilityIgnoresInvertColors />
        )}
        <View style={{ padding: SP.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
            <Text style={{ color: accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {item.isUrgent ? 'Urgent' : 'New announcement'}
            </Text>
            <Text style={{ color: T.textFaint, fontSize: 12, marginLeft: 'auto' }}>{relativeTime(item.publishedAt)}</Text>
          </View>
          <Text numberOfLines={2} style={{ color: T.text, fontSize: 18, fontWeight: '800', marginTop: SP.sm, letterSpacing: -0.2 }}>{item.title}</Text>
          <Text numberOfLines={2} style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginTop: 6 }}>{preview}</Text>
        </View>
      </Pressable>
      {onSeeAll && unread > 1 && (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={`See all ${unread} unread announcements`}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: SP.lg,
            borderTopWidth: 1, borderTopColor: T.line, backgroundColor: pressed ? T.bgInputActive : 'transparent',
          })}
        >
          <Text style={{ color: T.textSub, fontSize: 13, fontWeight: '600' }}>{unread} unread announcements</Text>
          <Feather name="arrow-right" size={16} color={T.textSub} />
        </Pressable>
      )}
    </View>
  );
}
