import React, { useCallback, useState } from 'react';
import { FlatList, ListRenderItemInfo, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../common/components/EmptyState';
import BottomSheet from '../../common/components/BottomSheet';
import Avatar from '../../common/components/Avatar';
import { SwitchRow } from '../../common/components/FormFields';
import { useToast } from '../../common/components/Toast';
import { useContacts, useConversations, useMyMessagingSettings, useOpenConversation, useSaveMyMessagingSettings } from '../api/messagingQueries';
import type { ConversationSummary, MessageContact } from '../api/messaging.types';
import { ConversationRow } from '../components/MessagingUi';

interface Props {
  /** Which app: members talk to their coaches, trainers to their clients. */
  side: 'member' | 'trainer';
  onBack?: () => void;
  onOpen: (conversationId: number) => void;
}

const keyOf = (c: ConversationSummary) => String(c.id);
const Gap = () => <View style={{ height: 10 }} />;

/** The inbox (polled every 60 s), "New message" from the people you can message, and (members) the opt-out switch. */
export default function MessagesScreen({ side, onBack, onOpen }: Props) {
  const { hPad } = useLayout();
  const toast = useToast();
  const q = useConversations();
  const contacts = useContacts();
  const open = useOpenConversation();
  const settings = useMyMessagingSettings(side === 'member');
  const saveSettings = useSaveMyMessagingSettings();
  const [picker, setPicker] = useState(false);
  const member = side === 'member';
  const rows = q.data ?? [];
  const people = contacts.data ?? [];

  const start = (c: MessageContact) => {
    setPicker(false);
    if (c.conversationId) { onOpen(c.conversationId); return; }
    open.mutate(c.person.userId, { onSuccess: d => onOpen(d.id), onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) });
  };
  const newMessage = () => (people.length === 1 ? start(people[0]) : setPicker(true));
  const renderRow = useCallback(({ item }: ListRenderItemInfo<ConversationSummary>) => <ConversationRow c={item} onPress={onOpen} />, [onOpen]);

  const cta = member ? 'Message your coach' : 'Message a client';
  const optOut = member && settings.data ? (
    <View style={{ marginTop: SP.xl }}>
      <SwitchRow label="Allow my trainer to message me" value={settings.data.allowTrainerMessages}
        description="When off, you and your trainers can't send messages here."
        onValueChange={v => saveSettings.mutate({ allowTrainerMessages: v }, { onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) })} />
    </View>
  ) : null;

  return (
    <Screen>
      <ScreenHeader eyebrow={member ? 'Your coaches' : 'Your clients'} title="Messages" onBack={onBack}
        action={people.length > 0 ? { label: 'New', icon: 'edit', onPress: newMessage } : undefined} />

      {q.isLoading && <View style={{ paddingHorizontal: hPad }}><Skeleton rows={4} height={72} /></View>}
      {q.isError && (
        <EmptyState icon="wifi-off" tone="error" title="Couldn't load your messages" subtitle={describeApiError(q.error).message}
          action={{ label: 'Try again', onPress: () => q.refetch() }} />
      )}
      {!q.isLoading && !q.isError && (
        <FlatList
          data={rows}
          keyExtractor={keyOf}
          renderItem={renderRow}
          ItemSeparatorComponent={Gap}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} colors={[T.brand]} />}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 110, flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}
          ListEmptyComponent={
            <EmptyState icon="message-circle" title="No messages yet"
              subtitle={people.length > 0
                ? (member ? 'Questions about your training? Your coach is a message away.' : 'Check in with a client, share a workout or answer a question.')
                : (member ? 'Once a coach is assigned to you or you book personal training, you can message them here.' : 'Clients assigned to you, or with a PT session in the last or next 90 days, appear here.')}
              action={people.length > 0 ? { label: cta, onPress: newMessage } : undefined} />
          }
          ListFooterComponent={optOut}
        />
      )}

      <BottomSheet visible={picker} onClose={() => setPicker(false)} title={cta}>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
          {people.map(c => (
            <Pressable key={c.person.userId} onPress={() => start(c)} accessibilityRole="button" accessibilityLabel={`Message ${c.person.name}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, minHeight: 56, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : T.bgInput })}>
              <Avatar uri={c.person.avatarUrl} size={40} />
              <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '600' }}>{c.person.name}</Text>
              <Feather name={c.conversationId ? 'message-circle' : 'edit'} size={16} color={T.textFaint} />
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}
