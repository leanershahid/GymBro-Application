import React from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { useContacts, useUnreadMessages } from '../api/messagingQueries';

/**
 * Home entry: "Message your coach" (member) / "Messages" (trainer), with the unread count.
 * Hidden when there's nobody to message and nothing unread.
 */
export default function MessagesEntryCard({ side, onPress, style }: { side: 'member' | 'trainer'; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const unread = useUnreadMessages().data?.total ?? 0;
  const contacts = useContacts().data ?? [];
  if (unread === 0 && contacts.length === 0) return null;
  const member = side === 'member';
  const title = unread > 0 ? `${unread} new message${unread > 1 ? 's' : ''}` : member ? 'Message your coach' : 'Messages';
  const sub = unread > 0
    ? (member ? 'Your coach replied' : 'Clients are waiting on a reply')
    : member ? `Ask ${contacts.length === 1 ? contacts[0].person.name : 'your coaches'} about your training` : `${contacts.length} client${contacts.length > 1 ? 's' : ''} you can message`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [style, {
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.lg, borderRadius: R.xl, borderWidth: 1, minHeight: 64,
        borderColor: unread > 0 ? withAlpha(T.brand, 0.35) : T.bgInputActive, backgroundColor: pressed ? T.bgInputActive : T.bgInput,
      }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.14) }}>
        <Feather name="message-circle" size={18} color={T.brand} />
        {unread > 0 && <View style={{ position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: T.brand, borderWidth: 1.5, borderColor: T.bgInput }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13 }}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={T.textFaint} />
    </Pressable>
  );
}
