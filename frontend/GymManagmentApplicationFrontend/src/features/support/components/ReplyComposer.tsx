import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, R, SP, withAlpha } from '../../../theme';
import { PhotoStrip, usePhotoPicker } from './SupportUi';

interface Props {
  placeholder?: string;
  /** Sends; resolve to clear the box, reject to keep the text. */
  onSend: (body: string, photos: string[]) => Promise<unknown> | void;
  sending?: boolean;
  /** Gold "staff only" look for internal notes. */
  tone?: 'default' | 'note';
  /** Pre-fills the box (canned replies). */
  value?: string;
  onChangeValue?: (v: string) => void;
  sendLabel?: string;
  extra?: React.ReactNode;
}

/** Message box + photo button + send, pinned under a thread. */
export default function ReplyComposer({ placeholder = 'Write a message…', onSend, sending, tone = 'default', value, onChangeValue, sendLabel = 'Send', extra }: Props) {
  const [own, setOwn] = useState('');
  const text = value ?? own;
  const setText = onChangeValue ?? setOwn;
  const [photos, setPhotos] = useState<string[]>([]);
  const picker = usePhotoPicker(photos, setPhotos);
  const accent = tone === 'note' ? T.brandGold : T.brand;
  const canSend = text.trim().length > 0 && !sending && !picker.busy;

  const send = async () => {
    if (!canSend) return;
    const body = text.trim();
    const shots = photos;
    setText('');
    setPhotos([]);
    try { await onSend(body, shots); }
    catch { setText(body); setPhotos(shots); }
  };

  return (
    <View style={{ gap: 8, paddingTop: SP.sm }}>
      {extra}
      <PhotoStrip urls={photos} size={56} onRemove={u => setPhotos(photos.filter(p => p !== u))} />
      {picker.error && <Text style={{ color: T.err, fontSize: 12 }}>{picker.error}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Pressable onPress={picker.pick} disabled={picker.full || picker.busy} accessibilityRole="button"
          accessibilityLabel={picker.full ? 'Photo limit reached' : 'Add a photo'}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', opacity: picker.full ? 0.4 : 1 }}>
          {picker.busy ? <ActivityIndicator color={T.brand} /> : <Feather name="camera" size={18} color={T.text} />}
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={T.textFaint}
          multiline
          maxLength={4000}
          accessibilityLabel={placeholder}
          style={{
            flex: 1, minHeight: 44, maxHeight: 140, color: T.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 11,
            backgroundColor: tone === 'note' ? withAlpha(T.brandGold, 0.08) : T.bgInput, borderRadius: R.lg, borderWidth: 1,
            borderColor: tone === 'note' ? withAlpha(T.brandGold, 0.35) : T.line,
          }}
        />
        <Pressable onPress={send} disabled={!canSend} accessibilityRole="button" accessibilityLabel={sendLabel} accessibilityState={{ disabled: !canSend }}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: canSend ? accent : T.bgInputActive, alignItems: 'center', justifyContent: 'center' }}>
          {sending ? <ActivityIndicator color={T.onBrand} /> : <Feather name="send" size={18} color={canSend ? T.onBrand : T.textFaint} />}
        </Pressable>
      </View>
    </View>
  );
}
