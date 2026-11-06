import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import StatusPill from '../../common/components/StatusPill';
import PrimaryButton from '../../common/components/PrimaryButton';
import { SwitchRow } from '../../common/components/FormFields';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { useMyConsents, useMySafety, useRecordConsent } from '../api/safetyQueries';
import { ConsentType, SafetyStep } from '../api/safety.types';
import { SafetyFlowRequest, fmtDay } from '../utils/safetyGate';
import { SafetyFlowModal } from './SafetyGateHost';
import { EmergencyFields, EmergencySaveButton, useEmergencyForm } from './EmergencyContactForm';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, marginBottom: SP.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.sm }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function StatusRow({ icon, label, value, tone, action, onPress }: {
  icon: FeatherIcon; label: string; value: string; tone: 'ok' | 'warn' | 'err' | 'neutral'; action?: string; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}${action ? `. ${action}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: T.line }}
    >
      <Feather name={icon} size={18} color={T.textSub} />
      <Text style={{ flex: 1, color: T.text, fontSize: 15 }}>{label}</Text>
      <StatusPill label={value} tone={tone} />
      {onPress && <Feather name="chevron-right" size={18} color={T.textFaint} />}
    </Pressable>
  );
}

const CONSENT_ROWS: { type: ConsentType; label: string; description: string }[] = [
  { type: 'health_data', label: 'Health information', description: 'Lets the gym keep your health check answers to train you safely.' },
  { type: 'marketing_email', label: 'News & offers by email', description: 'Promotions, events and gym news.' },
  { type: 'marketing_push', label: 'News & offers by notification', description: 'Push notifications about offers and events.' },
  { type: 'photo_media', label: 'Photos & videos', description: 'The gym may use photos or videos you appear in on its channels.' },
];

/**
 * Profile → "Safety & consents": waiver / health status, the structured emergency contact
 * (member-editable) and consent switches (append-only grant / withdraw). Self-contained: the
 * waiver / health steps open in a modal.
 */
export default function SafetyProfileSection() {
  const statusQ = useMySafety();
  const consentsQ = useMyConsents();
  const record = useRecordConsent();
  const [request, setRequest] = useState<SafetyFlowRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const open = (only: SafetyStep) => setRequest({ only });

  if (statusQ.isLoading) return <LoadingState label="Loading safety details" />;
  if (statusQ.isError || !statusQ.data) {
    return (
      <EmptyState icon="alert-triangle" tone="error" title="Couldn't load safety details"
        subtitle={describeApiError(statusQ.error).message} action={{ label: 'Try again', onPress: () => statusQ.refetch() }} />
    );
  }
  const c = statusQ.data;
  const h = c.health;

  const toggleConsent = async (type: ConsentType, granted: boolean) => {
    if (!granted && type === 'health_data') {
      const ok = await confirm({
        title: 'Withdraw health consent?',
        message: 'The gym will no longer use your health answers. You may need to give consent again to book classes.',
        confirmLabel: 'Withdraw', destructive: true,
      });
      if (!ok) return;
    }
    record.mutate({ type, granted }, { onError: e => showAlert('Could not save', apiErrorText(e)) });
  };

  return (
    <View>
      <Card title="Waiver & health check">
        {c.waivers.length === 0 ? (
          <StatusRow icon="file-text" label="Waiver" value="Not required" tone="neutral" />
        ) : c.waivers.map(w => (
          <StatusRow
            key={w.waiverId}
            icon="file-text"
            label={w.title}
            value={w.status === 'signed' ? `Signed v${w.signedVersion}` : w.status === 'resign_required' ? 'Re-sign needed' : 'Not signed'}
            tone={w.ok ? 'ok' : 'warn'}
            action={w.ok ? undefined : 'Sign now'}
            onPress={w.ok ? undefined : () => open('waiver')}
          />
        ))}
        <StatusRow
          icon="heart"
          label="Health check"
          value={h.status === 'missing' ? 'Not done' : h.status === 'expired' ? 'Expired'
            : h.status === 'needs_clearance' ? 'Clearance advised' : `Valid to ${fmtDay(h.expiresAt)}`}
          tone={h.status === 'missing' || h.status === 'expired' ? 'warn' : h.status === 'needs_clearance' ? 'warn' : 'ok'}
          action={h.status === 'missing' ? 'Take it now' : 'Retake'}
          onPress={() => open('health')}
        />
      </Card>

      <Card
        title="Emergency contact"
        right={!editing ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={c.emergencyContact ? 'Edit emergency contact' : 'Add emergency contact'}
            style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700' }}>{c.emergencyContact ? 'Edit' : 'Add'}</Text>
          </Pressable>
        ) : undefined}
      >
        {editing ? (
          <EmergencyEditor initial={c.emergencyContact} onDone={() => setEditing(false)} />
        ) : c.emergencyContact ? (
          <View style={{ gap: 4, paddingTop: SP.xs }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>
              {c.emergencyContact.name}{c.emergencyContact.relationship ? ` · ${c.emergencyContact.relationship}` : ''}
            </Text>
            <Text style={{ color: T.textSub, fontSize: 14 }}>{c.emergencyContact.phone}</Text>
            {c.emergencyContact.source === 'legacy' && (
              <Text style={{ color: T.brandGold, fontSize: 12, marginTop: 4 }}>From your old profile — tap Edit to confirm it.</Text>
            )}
          </View>
        ) : (
          <Text style={{ color: T.textSub, fontSize: 14, paddingTop: SP.xs }}>Add someone staff can call if you need help.</Text>
        )}
      </Card>

      <Card title="Consents">
        {consentsQ.isLoading ? <LoadingState label="Loading consents" /> : consentsQ.isError ? (
          <EmptyState icon="alert-triangle" tone="error" title="Couldn't load consents"
            subtitle={describeApiError(consentsQ.error).message} action={{ label: 'Try again', onPress: () => consentsQ.refetch() }} />
        ) : (
          <View style={{ paddingTop: SP.xs }}>
            {CONSENT_ROWS.map(row => {
              const cur = consentsQ.data?.current.find(x => x.type === row.type);
              return (
                <SwitchRow
                  key={row.type}
                  label={row.label}
                  description={cur?.at ? `${row.description} ${cur.granted ? 'Given' : 'Withdrawn'} ${fmtDay(cur.at)}.` : row.description}
                  value={!!cur?.granted}
                  onValueChange={v => toggleConsent(row.type, v)}
                />
              );
            })}
            <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 17 }}>
              Every change is saved with the date, so you and the gym have a record.
            </Text>
          </View>
        )}
      </Card>

      <SafetyFlowModal request={request} onClose={() => setRequest(null)} />
    </View>
  );
}

function EmergencyEditor({ initial, onDone }: { initial: Parameters<typeof useEmergencyForm>[0]; onDone: () => void }) {
  const form = useEmergencyForm(initial);
  return (
    <View style={{ paddingTop: SP.sm }}>
      <EmergencyFields form={form} />
      <View style={{ flexDirection: 'row', gap: SP.md, marginTop: SP.sm }}>
        <PrimaryButton label="Cancel" variant="secondary" onPress={onDone} disabled={form.saving} style={{ flex: 1 }} />
        <View style={{ flex: 1 }}><EmergencySaveButton form={form} onSaved={onDone} label="Save" /></View>
      </View>
    </View>
  );
}
