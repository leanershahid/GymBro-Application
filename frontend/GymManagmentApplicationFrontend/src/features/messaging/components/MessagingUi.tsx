import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, SP, R, withAlpha } from '../../../theme';
import { uploadFile } from '../../../api/upload';
import { describeApiError } from '../../../api/apiError';
import Avatar from '../../common/components/Avatar';
import type { ConversationSummary, DirectMessage, MessageAttachment, OutgoingMessage, ReviewConversationSummary } from '../api/messaging.types';
import { listTime, timeOf } from '../utils/messageUtils';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// ── Inbox row ────────────────────────────────────────────────────────────

/** Avatar, name, last message, time and unread dot (React.memo: FlatList rows). */
export const ConversationRow = React.memo(function ConversationRow({ c, onPress }: { c: ConversationSummary; onPress: (id: number) => void }) {
  const unread = c.unread > 0;
  const preview = c.lastMessage ? (c.lastMessageMine ? `You: ${c.lastMessage}` : c.lastMessage) : 'No messages yet';
  return (
    <Pressable onPress={() => onPress(c.id)} accessibilityRole="button"
      accessibilityLabel={`${c.other.name}. ${unread ? `${c.unread} unread. ` : ''}${preview}. ${listTime(c.lastMessageAt)}${c.muted ? '. Muted' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: SP.md, padding: SP.md, minHeight: 72, borderRadius: R.lg,
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1, borderColor: unread ? withAlpha(T.brand, 0.3) : T.bgInputActive,
      })}>
      <Avatar uri={c.other.avatarUrl} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: unread ? '800' : '700' }}>{c.other.name}</Text>
          {c.muted && <Feather name="bell-off" size={13} color={T.textFaint} />}
          <Text style={{ color: unread ? T.brand : T.textFaint, fontSize: 12, fontWeight: unread ? '700' : '400' }}>{listTime(c.lastMessageAt)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: unread ? T.text : T.textSub, fontSize: 13 }}>{preview}</Text>
          {unread && (
            <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.onBrand, fontSize: 11, fontWeight: '800' }}>{c.unread > 99 ? '99+' : c.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

/** Admin review row: trainer ↔ member, last activity, count and reported badge. */
export const ReviewRow = React.memo(function ReviewRow({ c, onPress }: { c: ReviewConversationSummary; onPress: (id: number) => void }) {
  return (
    <Pressable onPress={() => onPress(c.id)} accessibilityRole="button"
      accessibilityLabel={`${c.trainer.name} and ${c.member.name}. ${c.messageCount} messages${c.reportedCount ? `, ${c.reportedCount} reported` : ''}. ${listTime(c.lastMessageAt)}`}
      style={({ pressed }) => ({
        padding: SP.md, borderRadius: R.lg, backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderWidth: 1,
        borderColor: c.reportedCount ? withAlpha(T.err, 0.35) : T.bgInputActive, gap: 4,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: T.text, fontSize: 15, fontWeight: '700' }}>{c.trainer.name} ↔ {c.member.name}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{listTime(c.lastMessageAt)}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13 }}>{c.lastMessage ?? ''}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{c.messageCount} message{c.messageCount === 1 ? '' : 's'}</Text>
        {c.reportedCount > 0 && <Text style={{ color: T.err, fontSize: 12, fontWeight: '700' }}>{c.reportedCount} reported</Text>}
      </View>
    </Pressable>
  );
});

// ── Thread ───────────────────────────────────────────────────────────────

export function DaySeparator({ label }: { label: string }) {
  return (
    <View accessibilityRole="header" style={{ alignItems: 'center', marginVertical: SP.md }}>
      <Text style={{ color: T.textFaint, fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 3, borderRadius: R.pill, backgroundColor: T.bgInput }}>{label}</Text>
    </View>
  );
}

type BubbleState = 'sending' | 'failed' | 'sent' | 'read' | null;

interface BubbleProps {
  mine: boolean;
  body: string;
  photoUrl: string | null;
  attachment: MessageAttachment | null;
  createdAt: string;
  state?: BubbleState;
  error?: string;
  reported?: boolean;
  redacted?: boolean;
  senderName?: string | null;
  onRetry?: () => void;
  onOpenPhoto?: (url: string) => void;
  onOpenAttachment?: (a: MessageAttachment) => void;
  onLongPress?: () => void;
}

const STATE_TEXT: Record<Exclude<BubbleState, null>, string> = { sending: 'Sending…', failed: 'Not sent', sent: 'Sent', read: 'Read' };

/** One chat bubble: mine on the right (green tint), theirs on the left. */
export const Bubble = React.memo(function Bubble(p: BubbleProps) {
  const tint = p.mine ? withAlpha(T.brand, 0.16) : T.bgInput;
  const failed = p.state === 'failed';
  const a11y = [p.mine ? 'You' : p.senderName ?? 'Them', p.body || (p.photoUrl ? 'Photo' : ''), p.attachment ? `Shared ${p.attachment.type}: ${p.attachment.title}` : '',
    timeOf(p.createdAt), p.state ? STATE_TEXT[p.state] : '', p.reported ? 'Reported' : ''].filter(Boolean).join('. ');
  return (
    <View style={{ alignItems: p.mine ? 'flex-end' : 'flex-start', marginBottom: SP.sm }}>
      {p.senderName && <Text style={{ color: T.textFaint, fontSize: 11, marginBottom: 2, marginHorizontal: 4 }}>{p.senderName}</Text>}
      <Pressable onLongPress={p.onLongPress} delayLongPress={350} accessible accessibilityLabel={a11y}
        accessibilityHint={p.onLongPress ? 'Long press for options' : undefined}
        style={{
          maxWidth: '82%', borderRadius: R.lg, padding: p.photoUrl && !p.body ? 4 : SP.md, gap: 6,
          borderBottomRightRadius: p.mine ? R.sm : R.lg, borderBottomLeftRadius: p.mine ? R.lg : R.sm,
          backgroundColor: tint, borderWidth: 1, borderColor: failed ? withAlpha(T.err, 0.5) : p.mine ? withAlpha(T.brand, 0.3) : T.line,
          opacity: p.state === 'sending' ? 0.7 : 1,
        }}>
        {p.photoUrl && (
          <Pressable onPress={() => p.onOpenPhoto?.(p.photoUrl!)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
            <Image source={{ uri: p.photoUrl }} style={{ width: 220, height: 220, borderRadius: R.md, backgroundColor: T.bgInputActive }} resizeMode="cover" />
          </Pressable>
        )}
        {!!p.body && (
          <Text selectable style={{ color: p.redacted ? T.textFaint : T.text, fontSize: 15, lineHeight: 21, fontStyle: p.redacted ? 'italic' : 'normal' }}>{p.body}</Text>
        )}
        {p.attachment && (
          <Pressable onPress={() => p.onOpenAttachment?.(p.attachment!)} disabled={!p.onOpenAttachment} accessibilityRole="link"
            accessibilityLabel={`Open ${p.attachment.type} ${p.attachment.title}`}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 8, padding: SP.sm, borderRadius: R.md, minHeight: 44,
              backgroundColor: pressed ? T.bgInputActive : withAlpha(T.black, 0.25),
            })}>
            <Feather name={p.attachment.type === 'plan' ? 'book-open' : 'activity'} size={16} color={T.brand} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>{p.attachment.type === 'plan' ? 'Training plan' : 'Workout'}</Text>
              <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{p.attachment.title}</Text>
            </View>
            {p.onOpenAttachment && <Feather name="chevron-right" size={16} color={T.textFaint} />}
          </Pressable>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, marginHorizontal: 4 }}>
        {p.reported && <Text style={{ color: T.err, fontSize: 11, fontWeight: '600' }}>Reported</Text>}
        <Text style={{ color: failed ? T.err : T.textFaint, fontSize: 11 }}>
          {failed ? (p.error ?? STATE_TEXT.failed) : `${timeOf(p.createdAt)}${p.state ? ` · ${STATE_TEXT[p.state]}` : ''}`}
        </Text>
        {failed && p.onRetry && (
          <Pressable onPress={p.onRetry} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retry sending this message"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 24 }}>
            <Feather name="rotate-cw" size={12} color={T.brand} />
            <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

/** Props for a stored message. */
export const storedBubble = (m: DirectMessage, state: BubbleState) => ({
  mine: m.mine, body: m.body, photoUrl: m.photoUrl, attachment: m.attachment, createdAt: m.createdAt, reported: m.reported, redacted: m.redacted, state,
});
/** Props for a message still on its way. */
export const outgoingBubble = (o: OutgoingMessage) => ({
  mine: true, body: o.body, photoUrl: o.photoUrl, attachment: o.attachment, createdAt: o.createdAt, state: o.status, error: o.error,
});

/** Full-screen photo with a close button (tap anywhere to close). */
export function ImageViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo"
        style={{ flex: 1, backgroundColor: T.black, alignItems: 'center', justifyContent: 'center' }}>
        {url && <Image source={{ uri: url }} style={{ width: '100%', height: '80%' }} resizeMode="contain" accessibilityIgnoresInvertColors />}
        <View style={{ position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: T.overlay, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="x" size={22} color={T.text} />
        </View>
      </Pressable>
    </Modal>
  );
}

export function Banner({ icon, tone, children }: { icon: FeatherName; tone: string; children: React.ReactNode }) {
  return (
    <View accessibilityRole="text" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(tone, 0.1), borderWidth: 1, borderColor: withAlpha(tone, 0.28) }}>
      <Feather name={icon} size={16} color={tone} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: T.text, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

// ── Photo picking (one photo per message) ───────────────────────────────

export function useSinglePhoto() {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    if (busy) return;
    setError(null);
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { setError('Allow photo access to add a picture.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    setBusy(true);
    try {
      const res = await uploadFile<{ url: string }>('/uploads?kind=image&folder=media', 'file', { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      if (res.success && res.data?.url) setUrl(res.data.url);
      else setError(res.message || "Couldn't upload this photo.");
    } catch (e) {
      setError(describeApiError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return { url, setUrl, busy, error, pick };
}

export function PhotoChip({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <View style={{ width: 64, height: 64 }}>
      <Image source={{ uri: url }} style={{ width: 64, height: 64, borderRadius: R.md }} accessibilityLabel="Photo to send" />
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove photo"
        style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: T.bgInputActive, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="x" size={13} color={T.text} />
      </Pressable>
    </View>
  );
}

export function RoundButton({ icon, label, onPress, disabled, busy, primary }: { icon: FeatherName; label: string; onPress: () => void; disabled?: boolean; busy?: boolean; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={{
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: disabled && !primary ? 0.4 : 1,
        backgroundColor: primary ? (disabled ? T.bgInputActive : T.brand) : T.bgInputActive, borderWidth: primary ? 0 : 1, borderColor: T.line,
      }}>
      {busy ? <ActivityIndicator color={primary ? T.onBrand : T.brand} /> : <Feather name={icon} size={18} color={primary ? (disabled ? T.textFaint : T.onBrand) : T.text} />}
    </Pressable>
  );
}
