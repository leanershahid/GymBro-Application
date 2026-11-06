import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import SmallButton from '../../common/components/SmallButton';
import { describeApiError } from '../../../api/apiError';
import { useApiAccess } from '../../access/context/AccessContext';
import { useMemberSafety } from '../api/safetyQueries';
import { SafetyCompliance } from '../api/safety.types';
import { MISSING_LABEL, fmtDay } from '../utils/safetyGate';
import SignedWaiverSheet from './SignedWaiverSheet';
import HealthAnswersSheet from './HealthAnswersSheet';

/** Status chips for a member: "Signed v3" · "Health: needs clearance" · "Expires 12 Mar 2027". */
export function safetyChips(c: SafetyCompliance): { label: string; tone: PillTone }[] {
  const chips: { label: string; tone: PillTone }[] = [];
  if (c.waivers.length === 0) chips.push({ label: 'No waiver set up', tone: 'neutral' });
  for (const w of c.waivers) {
    chips.push(w.status === 'signed'
      ? { label: `Signed v${w.signedVersion}`, tone: 'ok' }
      : w.status === 'resign_required' ? { label: `Re-sign v${w.latestVersion}`, tone: 'warn' } : { label: 'Waiver not signed', tone: 'err' });
  }
  const h = c.health;
  chips.push(
    h.status === 'missing' ? { label: 'Health: not done', tone: 'err' }
      : h.status === 'expired' ? { label: 'Health: expired', tone: 'err' }
      : h.status === 'needs_clearance' ? { label: 'Health: needs clearance', tone: 'warn' }
      : h.status === 'cleared' ? { label: 'Health: cleared', tone: 'ok' }
      : { label: 'Health: OK', tone: 'ok' });
  if (h.expiresAt && h.status !== 'missing') chips.push({ label: `${h.status === 'expired' ? 'Expired' : 'Expires'} ${fmtDay(h.expiresAt)}`, tone: h.status === 'expired' ? 'err' : 'neutral' });
  return chips;
}

const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * Member detail → "Waivers & health": compliance chips, one-tap emergency call, signed waivers
 * (view / print), health answers (only when allowed) and recent desk overrides.
 * Matches the Section look of MemberDetailPage.
 */
export default function MemberSafetySection({ memberId, memberName }: { memberId: number; memberName: string }) {
  const q = useMemberSafety(memberId);
  const canClear = useApiAccess('health-screening').canEdit;
  const [signatureId, setSignatureId] = useState<number | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);

  const shell = (children: React.ReactNode) => (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, paddingHorizontal: SP.lg, paddingBottom: SP.md, marginBottom: SP.lg }}>
      <Text accessibilityRole="header" style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', paddingTop: SP.md, paddingBottom: 4 }}>
        Waivers & health
      </Text>
      {children}
    </View>
  );

  if (q.isLoading) return shell(<LoadingState label="Loading waivers & health" />);
  if (q.isError || !q.data) {
    return shell(
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load waivers & health"
        subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />,
    );
  }

  const { compliance: c, signatures, canViewHealthAnswers, recentOverrides } = q.data;
  const ec = c.emergencyContact;
  const blocked = c.gatingEnabled && !c.canBook;

  return shell(
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm, paddingVertical: SP.sm }}>
        {safetyChips(c).map(ch => <StatusPill key={ch.label} label={ch.label} tone={ch.tone} dot />)}
      </View>

      {blocked && (
        <View accessible accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: SP.md, borderRadius: R.md, backgroundColor: withAlpha(T.brandGold, 0.08), borderWidth: 1, borderColor: withAlpha(T.brandGold, 0.25), marginBottom: SP.sm }}>
          <Feather name="alert-triangle" size={14} color={T.brandGold} />
          <Text style={{ flex: 1, color: T.brandGold, fontSize: 12, fontWeight: '600' }}>
            Can't self-book or check in: {c.missing.map(m => MISSING_LABEL[m]).join(' · ')}. Desk check-in can override.
          </Text>
        </View>
      )}

      {/* Emergency contact — one tap to call */}
      {ec ? (
        <Pressable
          onPress={() => Linking.openURL(telUrl(ec.phone))}
          accessibilityRole="button"
          accessibilityLabel={`Call emergency contact ${ec.name}${ec.relationship ? `, ${ec.relationship}` : ''}, ${ec.phone}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: T.line, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.err, 0.12) }}>
            <Feather name="phone-call" size={17} color={T.err} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Emergency contact</Text>
            <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>
              {ec.name}{ec.relationship ? ` · ${ec.relationship}` : ''}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 13 }}>{ec.phone}{ec.source === 'legacy' ? ' · from old profile' : ''}</Text>
          </View>
          <Text style={{ color: T.err, fontSize: 13, fontWeight: '700' }}>Call</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48, borderTopWidth: 1, borderTopColor: T.line }}>
          <Feather name="phone-off" size={16} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 14 }}>No emergency contact on file</Text>
        </View>
      )}

      {/* Signed waivers */}
      {signatures.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 48, borderTopWidth: 1, borderTopColor: T.line }}>
          <Feather name="file" size={16} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 14 }}>No waivers signed yet</Text>
        </View>
      ) : signatures.map(s => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: T.line }}>
          <Feather name="file-text" size={17} color={T.brand} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{s.title} · v{s.version}</Text>
            <Text style={{ color: T.textFaint, fontSize: 12 }}>Signed “{s.signedName}” · {fmtDay(s.signedAt)}</Text>
          </View>
          <SmallButton icon="eye" label="View" size="sm" onPress={() => setSignatureId(s.id)} />
        </View>
      ))}

      {/* Health answers */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: T.line }}>
        <Feather name="heart" size={17} color={T.rose} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>Health answers</Text>
          <Text style={{ color: T.textFaint, fontSize: 12 }}>
            {canViewHealthAnswers ? 'Confidential — admins and the member’s trainer only' : 'Only admins with health access and the member’s trainer can see these'}
          </Text>
        </View>
        {canViewHealthAnswers && c.health.status !== 'missing' && (
          <SmallButton icon="lock" label="Open" size="sm" tone={T.rose} onPress={() => setHealthOpen(true)} />
        )}
      </View>

      {recentOverrides.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: SP.sm, gap: 4 }}>
          <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Desk overrides</Text>
          {recentOverrides.slice(0, 3).map(o => (
            <Text key={o.id} style={{ color: T.textSub, fontSize: 12 }}>
              {fmtDay(o.at)} · {o.overriddenByName ?? `Staff #${o.overriddenByUserId}`} · {o.missing.map(m => MISSING_LABEL[m] ?? m).join(', ')}{o.reason ? ` — ${o.reason}` : ''}
            </Text>
          ))}
        </View>
      )}

      <SignedWaiverSheet signatureId={signatureId} onClose={() => setSignatureId(null)} />
      {canViewHealthAnswers && (
        <HealthAnswersSheet memberId={memberId} memberName={memberName} visible={healthOpen} canClear={canClear} onClose={() => setHealthOpen(false)} />
      )}
    </>,
  );
}
