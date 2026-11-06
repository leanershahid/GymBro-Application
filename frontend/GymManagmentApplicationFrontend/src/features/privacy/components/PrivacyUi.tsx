import React from 'react';
import { Linking, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { showAlert } from '../../common/components/dialogs';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

/** A titled card, as on the other settings screens. */
export function Card({ title, subtitle, right, tone, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; tone?: 'danger'; children: React.ReactNode;
}) {
  const border = tone === 'danger' ? withAlpha(T.err, 0.3) : T.line;
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: border, padding: SP.lg, marginBottom: SP.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: subtitle ? SP.xs : SP.md }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: T.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
        {right}
      </View>
      {!!subtitle && <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginBottom: SP.md }}>{subtitle}</Text>}
      {children}
    </View>
  );
}

/** An inline note: info (neutral), warn (gold) or danger (red). */
export function Notice({ tone = 'info', icon, title, children }: {
  tone?: 'info' | 'warn' | 'danger'; icon?: FeatherIcon; title?: string; children?: React.ReactNode;
}) {
  const color = tone === 'danger' ? T.err : tone === 'warn' ? T.brandGold : T.sky;
  return (
    <View accessible accessibilityRole="text"
      style={{ flexDirection: 'row', gap: SP.md, padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(color, 0.1), borderWidth: 1, borderColor: withAlpha(color, 0.28), marginBottom: SP.md }}>
      <Feather name={icon ?? (tone === 'info' ? 'info' : 'alert-triangle')} size={18} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {!!title && <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>}
        {typeof children === 'string' ? <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>{children}</Text> : children}
      </View>
    </View>
  );
}

/** A bullet line for "what happens" lists. */
export function Bullet({ icon, children, tone }: { icon: FeatherIcon; children: string; tone?: 'danger' | 'ok' }) {
  const color = tone === 'danger' ? T.err : tone === 'ok' ? T.ok : T.textSub;
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, marginBottom: SP.sm }}>
      <Feather name={icon} size={16} color={color} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: T.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>
    </View>
  );
}

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtSize = (bytes?: number | null) =>
  bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Opens a web link (policy pages, downloads) in the browser on every platform. */
export async function openLink(url: string) {
  try { await Linking.openURL(url); }
  catch { showAlert('Couldn’t open the link', url); }
}
