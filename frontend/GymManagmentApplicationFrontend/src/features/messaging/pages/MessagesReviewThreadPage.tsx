import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, ListRenderItemInfo, View } from 'react-native';
import { T, SP } from '../../../theme';
import { useLayout } from '../../../utils/useLayout';
import { describeApiError } from '../../../api/apiError';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import { useReviewThread } from '../api/messagingQueries';
import { ThreadItem, threadItems } from '../utils/messageUtils';
import { Banner, Bubble, DaySeparator, ImageViewer, storedBubble } from '../components/MessagingUi';

const keyOf = (i: ThreadItem) => i.key;

/** One thread, read-only, for safeguarding (opening it is audit-logged on the server). Trainer on the right. */
export default function MessagesReviewThreadPage({ conversationId, onBack }: { conversationId: number; onBack: () => void }) {
  const { hPad } = useLayout();
  const q = useReviewThread(conversationId);
  const [photo, setPhoto] = useState<string | null>(null);
  const t = q.data;
  // Show the trainer's messages as "right side" so the two voices are easy to tell apart.
  const messages = useMemo(() => (t?.messages ?? []).map(m => ({ ...m, mine: m.senderId === t?.trainer.userId })), [t]);
  const items = useMemo(() => threadItems(messages, []), [messages]);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<ThreadItem>) => {
    if (item.kind === 'day') return <DaySeparator label={item.label} />;
    if (item.kind !== 'message') return null;
    return <Bubble {...storedBubble(item.message, null)} senderName={item.message.senderName} onOpenPhoto={setPhoto} />;
  }, []);

  return (
    <Screen>
      <ScreenHeader eyebrow="Messages review" title={t ? `${t.trainer.name} ↔ ${t.member.name}` : 'Conversation'} onBack={onBack} />
      {q.isLoading && <LoadingState label="Loading conversation" />}
      {q.isError && <EmptyState icon="alert-triangle" tone="error" title="Couldn't load this conversation" subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />}
      {t && (
        <FlatList data={items} keyExtractor={keyOf} renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 48, width: '100%', maxWidth: 820, alignSelf: 'center' }}
          ListHeaderComponent={
            <View style={{ gap: SP.sm, marginBottom: SP.md }}>
              <Banner icon="eye" tone={T.brandGold}>Read-only safeguarding view. This visit has been recorded in the audit log.</Banner>
              {t.truncated && <Banner icon="info" tone={T.sky}>Showing the most recent 1,000 messages.</Banner>}
            </View>
          }
          ListEmptyComponent={<EmptyState icon="message-square" title="No messages in this conversation" />} />
      )}
      <ImageViewer url={photo} onClose={() => setPhoto(null)} />
    </Screen>
  );
}
