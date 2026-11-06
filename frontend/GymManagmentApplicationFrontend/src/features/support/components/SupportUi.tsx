import React, { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { T, R, SP, withAlpha } from '../../../theme';
import { uploadFile } from '../../../api/upload';
import { describeApiError } from '../../../api/apiError';
import { formatDate, formatDateTime } from '../../common/utils/format';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import { SupportCategory, SupportMessage, SupportPriority, SupportSla, SupportStatus } from '../api/support.types';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export const MAX_PHOTOS = 3;

export const STATUS_LABEL: Record<SupportStatus, string> = { open: 'Open', waiting: 'Waiting on you', resolved: 'Resolved', closed: 'Closed' };
/** Staff wording for the same statuses ("waiting on you" is the member's point of view). */
export const STAFF_STATUS_LABEL: Record<SupportStatus, string> = { open: 'Open', waiting: 'Waiting on member', resolved: 'Resolved', closed: 'Closed' };
export const STATUS_TONE: Record<SupportStatus, PillTone> = { open: 'info', waiting: 'warn', resolved: 'ok', closed: 'neutral' };
export const PRIORITY_LABEL: Record<SupportPriority, string> = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
export const PRIORITY_TONE: Record<SupportPriority, PillTone> = { low: 'neutral', normal: 'info', high: 'warn', urgent: 'err' };

export const CATEGORIES: { key: SupportCategory; label: string; icon: FeatherName; hint: string }[] = [
  { key: 'billing', label: 'Billing & membership', icon: 'credit-card', hint: 'Payments, invoices, your plan' },
  { key: 'classes', label: 'Classes & bookings', icon: 'calendar', hint: 'Booking, waitlists, schedule' },
  { key: 'facilities', label: 'Facilities & cleanliness', icon: 'droplet', hint: 'Showers, lockers, cleaning' },
  { key: 'equipment', label: 'Equipment', icon: 'tool', hint: 'Broken or missing kit' },
  { key: 'staff', label: 'Staff & trainers', icon: 'users', hint: 'Compliments or concerns' },
  { key: 'app', label: 'App problem', icon: 'smartphone', hint: 'Something not working here' },
  { key: 'feedback', label: 'Feedback / idea', icon: 'zap', hint: 'Tell us what would help' },
  { key: 'other', label: 'Other', icon: 'help-circle', hint: 'Anything else' },
];
export const categoryOf = (k: string) => CATEGORIES.find(c => c.key === k) ?? CATEGORIES[CATEGORIES.length - 1];

export const day = (s: string | null | undefined) => formatDate(s);
export const when = (s: string | null | undefined) => formatDateTime(s);

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function ago(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((now - t) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d ago` : formatDate(iso);
}

/** "in 3 h" / "5 h late" for an SLA due time. */
export function dueText(iso: string, now = Date.now()): string {
  const h = (new Date(iso).getTime() - now) / 3_600_000;
  const abs = Math.abs(h);
  const span = abs < 1 ? `${Math.max(1, Math.round(abs * 60))} min` : abs < 48 ? `${Math.round(abs)} h` : `${Math.round(abs / 24)} d`;
  return h >= 0 ? `due in ${span}` : `${span} overdue`;
}

export function StatusChip({ status, staff }: { status: SupportStatus; staff?: boolean }) {
  return <StatusPill label={(staff ? STAFF_STATUS_LABEL : STATUS_LABEL)[status]} tone={STATUS_TONE[status]} dot />;
}

/** Red "Overdue" / gold "Due soon" chip; nothing when on track. */
export function SlaChip({ sla }: { sla?: SupportSla | null }) {
  if (!sla || (!sla.overdue && !sla.dueSoon)) return null;
  return <StatusPill label={sla.overdue ? 'Overdue' : 'Due soon'} tone={sla.overdue ? 'err' : 'warn'} />;
}

export function Card({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{
      backgroundColor: T.bgInput, borderRadius: R.xl, borderWidth: 1,
      borderColor: accent ? withAlpha(accent, 0.3) : T.line, padding: SP.lg,
    }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.md }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: T.text, fontSize: 18, fontWeight: '700' }}>{children}</Text>
      {right}
    </View>
  );
}

export function Notice({ icon, tone, children }: { icon: FeatherName; tone: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, padding: SP.md, borderRadius: R.lg, backgroundColor: withAlpha(tone, 0.1), borderWidth: 1, borderColor: withAlpha(tone, 0.28) }}>
      <Feather name={icon} size={18} color={tone} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

/** Thumbnails that open the full photo. */
export function PhotoStrip({ urls, size = 72, onRemove }: { urls: string[]; size?: number; onRemove?: (url: string) => void }) {
  if (urls.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {urls.map((u, i) => (
        <View key={u}>
          <Pressable onPress={() => Linking.openURL(u)} accessibilityRole="imagebutton" accessibilityLabel={`Open photo ${i + 1}`}>
            <Image source={{ uri: u }} style={{ width: size, height: size, borderRadius: R.md, backgroundColor: T.bgInputActive }} />
          </Pressable>
          {onRemove && (
            <Pressable onPress={() => onRemove(u)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}
              style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: T.bgNav, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="x" size={13} color={T.text} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

/** Adds up to three photos (picked from the device, uploaded to /uploads). */
export function usePhotoPicker(photos: string[], setPhotos: (p: string[]) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    if (photos.length >= MAX_PHOTOS || busy) return;
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
      const res = await uploadFile<{ url: string }>('/uploads?kind=image&folder=media', 'file',
        { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
      if (res.success && res.data?.url) setPhotos([...photos, res.data.url]);
      else setError(res.message || "Couldn't upload this photo.");
    } catch (e) {
      setError(describeApiError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return { pick, busy, error, full: photos.length >= MAX_PHOTOS };
}

/** Field: thumbnails + "Add photo" tile. */
export function PhotoField({ photos, onChange, label = 'Photos (optional)' }: { photos: string[]; onChange: (p: string[]) => void; label?: string }) {
  const picker = usePhotoPicker(photos, onChange);
  return (
    <View style={{ marginBottom: SP.lg }}>
      <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 8 }}>{label} · up to {MAX_PHOTOS}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <PhotoStrip urls={photos} onRemove={u => onChange(photos.filter(p => p !== u))} />
        {!picker.full && (
          <Pressable onPress={picker.pick} disabled={picker.busy} accessibilityRole="button" accessibilityLabel="Add a photo"
            style={({ pressed }) => ({
              width: 72, height: 72, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: T.line,
              backgroundColor: pressed ? T.bgInputActive : T.bgInput, alignItems: 'center', justifyContent: 'center', gap: 4,
            })}>
            {picker.busy ? <ActivityIndicator color={T.brand} /> : <Feather name="camera" size={20} color={T.textSub} />}
            {!picker.busy && <Text style={{ color: T.textSub, fontSize: 11 }}>Add</Text>}
          </Pressable>
        )}
      </View>
      {picker.error && <Text style={{ color: T.err, fontSize: 12, marginTop: 6 }}>{picker.error}</Text>}
    </View>
  );
}

/** 1–5 stars, each a 44 pt target. */
export function StarRating({ value, onChange, size = 30, label = 'Rating' }: { value: number; onChange?: (v: number) => void; size?: number; label?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} disabled={!onChange} onPress={() => onChange?.(n)} hitSlop={4}
          accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} accessibilityState={{ selected: value === n }}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size, color: n <= value ? T.brandGold : T.textDisabled }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * One line of the thread: the caller's own messages on the right (green), the other side on the
 * left, internal notes in a gold "staff only" bubble, events as a small centred line.
 */
export const MessageBubble = React.memo(function MessageBubble({ m, viewer }: { m: SupportMessage; viewer: 'member' | 'staff' }) {
  if (m.kind === 'event') {
    return (
      <View style={{ alignItems: 'center', marginVertical: 6 }} accessible accessibilityLabel={`${m.body}, ${when(m.createdAt)}`}>
        <Text style={{ color: T.textFaint, fontSize: 12 }}>{m.body}{m.isInternal ? ' · staff only' : ''} · {ago(m.createdAt)}</Text>
      </View>
    );
  }
  const right = viewer === 'member' ? m.authorRole === 'member' : m.authorRole === 'staff';
  const note = m.kind === 'note' || m.isInternal;
  const bg = note ? withAlpha(T.brandGold, 0.12) : right ? withAlpha(T.brand, 0.14) : T.bgInputActive;
  const border = note ? withAlpha(T.brandGold, 0.35) : right ? withAlpha(T.brand, 0.3) : T.line;
  const who = note ? `Internal note${m.authorName ? ` · ${m.authorName}` : ''}` : m.mine ? 'You' : (m.authorName ?? (m.authorRole === 'member' ? 'Member' : 'The gym'));
  return (
    <View style={{ alignItems: right ? 'flex-end' : 'flex-start', marginVertical: 4, opacity: m.pending ? 0.6 : 1 }}
      accessible accessibilityLabel={`${who}: ${m.body}. ${m.pending ? 'Sending' : when(m.createdAt)}`}>
      <View style={{ maxWidth: '86%', backgroundColor: bg, borderWidth: 1, borderColor: border, padding: SP.md, gap: 6,
        borderRadius: R.lg, borderBottomRightRadius: right ? 4 : R.lg, borderBottomLeftRadius: right ? R.lg : 4 }}>
        <Text style={{ color: note ? T.brandGold : T.textSub, fontSize: 12, fontWeight: '600' }}>{who}</Text>
        <Text selectable style={{ color: T.text, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
        <PhotoStrip urls={m.photos} size={64} />
      </View>
      <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 3, marginHorizontal: 6 }}>{m.pending ? 'Sending…' : ago(m.createdAt)}</Text>
    </View>
  );
});

/** Pressable row used by lists (requests, FAQ). */
export function RowButton({ onPress, label, children, style }: { onPress: () => void; label: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [{
        backgroundColor: pressed ? T.bgInputActive : T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
        padding: SP.lg, minHeight: 56,
      }, style]}>
      {children}
    </Pressable>
  );
}
