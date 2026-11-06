import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import EmptyState from '../../common/components/EmptyState';
import LoadingState from '../../common/components/LoadingState';
import type { MessageAttachment } from '../api/messaging.types';
import { MAX_MESSAGE_LENGTH } from '../utils/messageUtils';
import { PhotoChip, RoundButton, useSinglePhoto } from './MessagingUi';

interface Props {
  onSend: (m: { body: string; photoUrl: string | null; attachment: MessageAttachment | null }) => void;
  /** Trainers: the workouts / plans they can link (loaded when the sheet opens). */
  attachables?: { items: MessageAttachment[]; loading: boolean; onOpen: () => void } | null;
}

/**
 * Text box + photo + (trainers) "share a workout / plan" + send. Sending is optimistic: the box
 * clears at once and the thread shows the message as "Sending…".
 */
export default function MessageComposer({ onSend, attachables }: Props) {
  const [text, setText] = useState('');
  const photo = useSinglePhoto();
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [sheet, setSheet] = useState(false);
  const canSend = (text.trim().length > 0 || !!photo.url || !!attachment) && !photo.busy;
  const left = MAX_MESSAGE_LENGTH - text.length;

  const send = () => {
    if (!canSend) return;
    onSend({ body: text.trim(), photoUrl: photo.url, attachment });
    setText('');
    photo.setUrl(null);
    setAttachment(null);
  };

  return (
    <View style={{ gap: 8, paddingTop: SP.sm }}>
      {(photo.url || attachment) && (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {photo.url && <PhotoChip url={photo.url} onRemove={() => photo.setUrl(null)} />}
          {attachment && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, borderRadius: R.pill, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 1, borderColor: withAlpha(T.brand, 0.3) }}>
              <Feather name={attachment.type === 'plan' ? 'book-open' : 'activity'} size={14} color={T.brand} />
              <Text numberOfLines={1} style={{ color: T.text, fontSize: 13, maxWidth: 200 }}>{attachment.title}</Text>
              <Pressable onPress={() => setAttachment(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${attachment.title}`}
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="x" size={14} color={T.textSub} />
              </Pressable>
            </View>
          )}
        </View>
      )}
      {photo.error && <Text accessibilityLiveRegion="polite" style={{ color: T.err, fontSize: 12 }}>{photo.error}</Text>}
      {left < 200 && <Text style={{ color: left < 0 ? T.err : T.textFaint, fontSize: 11, alignSelf: 'flex-end' }}>{left} characters left</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <RoundButton icon="camera" label={photo.url ? 'Replace the photo' : 'Add a photo'} onPress={photo.pick} busy={photo.busy} />
        {attachables && (
          <RoundButton icon="paperclip" label="Share a workout or plan" onPress={() => { attachables.onOpen(); setSheet(true); }} />
        )}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a message…"
          placeholderTextColor={T.textFaint}
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          accessibilityLabel="Message"
          style={{ flex: 1, minHeight: 44, maxHeight: 140, color: T.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line }}
        />
        <RoundButton icon="send" label="Send message" onPress={send} disabled={!canSend} primary />
      </View>

      {attachables && (
        <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Share a workout or plan">
          {attachables.loading && <LoadingState label="Loading assignments" />}
          {!attachables.loading && attachables.items.length === 0 && (
            <EmptyState icon="activity" title="Nothing to share yet" subtitle="Assign a workout or plan to this member first, then link it here." />
          )}
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {attachables.items.map(a => (
              <Pressable key={`${a.type}-${a.id}`} onPress={() => { setAttachment(a); setSheet(false); }} accessibilityRole="button"
                accessibilityLabel={`Share ${a.type} ${a.title}`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: SP.md, minHeight: 52, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : T.bgInput })}>
                <Feather name={a.type === 'plan' ? 'book-open' : 'activity'} size={16} color={T.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{a.type === 'plan' ? 'Training plan' : 'Workout'}</Text>
                  <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{a.title}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}
