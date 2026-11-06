import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { T, SP, R } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import SmallButton from '../../common/components/SmallButton';
import StatusPill from '../../common/components/StatusPill';
import ChipSelect from '../../common/components/ChipSelect';
import { Field, SwitchRow } from '../../common/components/FormFields';
import { confirm, showAlert } from '../../common/components/dialogs';
import { useToast } from '../../common/components/Toast';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import {
  useAdminWaivers, useCreateWaiver, usePublishWaiverVersion, useSafetySettings, useSaveSafetySettings,
  useUpdateWaiver, useWaiverTemplate,
} from '../api/safetyQueries';
import { AdminWaiver, SafetySettings } from '../api/safety.types';
import WaiverText from '../components/WaiverText';
import { Notice } from '../components/SafetyUi';
import { fmtDay } from '../utils/safetyGate';

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg, marginBottom: SP.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.md }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const VALIDITY = [
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
];

type Editing = { mode: 'new' } | { mode: 'version'; waiver: AdminWaiver } | null;

/** Admin → "Waivers & health": waiver documents (versioned) and the booking / check-in gate. */
export default function WaiverSettingsPage({ onBack }: { onBack?: () => void }) {
  const waiversQ = useAdminWaivers();
  const [editing, setEditing] = useState<Editing>(null);

  if (editing) return <WaiverEditor editing={editing} onClose={() => setEditing(null)} />;

  return (
    <Screen>
      <ScreenHeader eyebrow="Settings" title="Waivers & health" onBack={onBack}
        action={{ label: 'New waiver', icon: 'plus', onPress: () => setEditing({ mode: 'new' }) }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={waiversQ.isRefetching} onRefresh={() => waiversQ.refetch()} tintColor={T.brand} />}
      >
        <GatingSection />

        <Section title="Waivers">
          {waiversQ.isLoading ? <LoadingState label="Loading waivers" /> : waiversQ.isError ? (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load waivers"
              subtitle={describeApiError(waiversQ.error).message} action={{ label: 'Try again', onPress: () => waiversQ.refetch() }} />
          ) : (waiversQ.data ?? []).length === 0 ? (
            <EmptyState icon="file-text" title="No waiver yet"
              subtitle="Members can't be asked to sign until you publish one. Start from our template — and have it checked by a lawyer."
              action={{ label: 'Create waiver', onPress: () => setEditing({ mode: 'new' }) }} />
          ) : (waiversQ.data ?? []).map(w => <WaiverRow key={w.id} waiver={w} onEdit={() => setEditing({ mode: 'version', waiver: w })} />)}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function GatingSection() {
  const q = useSafetySettings();
  const save = useSaveSafetySettings();
  const { show } = useToast();
  const [s, setS] = useState<SafetySettings | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);

  if (q.isLoading || (!s && !q.isError)) return <Section title="Booking & check-in"><LoadingState label="Loading settings" /></Section>;
  if (q.isError || !s) {
    return (
      <Section title="Booking & check-in">
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load settings"
          subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
      </Section>
    );
  }
  const dirty = JSON.stringify(s) !== JSON.stringify(q.data);
  const patch = (p: Partial<SafetySettings>) => setS(prev => (prev ? { ...prev, ...p } : prev));

  return (
    <Section title="Booking & check-in">
      <SwitchRow
        label="Require waiver & health check"
        description="Members must have a signed waiver and an up-to-date health check to book classes, book PT or check themselves in. Front desk can still override (it's logged)."
        value={s.gatingEnabled}
        onValueChange={v => patch({ gatingEnabled: v })}
      />
      <SwitchRow
        label="Also wait for medical clearance"
        description="When a member answers yes to a health question, block booking until staff record a doctor's clearance."
        value={s.blockUntilCleared}
        onValueChange={v => patch({ blockUntilCleared: v })}
      />
      <SwitchRow
        label="Require an emergency contact"
        description="Members must add an emergency contact before booking."
        value={s.requireEmergencyContact}
        onValueChange={v => patch({ requireEmergencyContact: v })}
      />
      <ChipSelect<number>
        label="Health check is valid for"
        options={VALIDITY.some(o => o.value === s.healthValidDays) ? VALIDITY : [...VALIDITY, { value: s.healthValidDays, label: `${s.healthValidDays} days` }]}
        value={s.healthValidDays}
        onChange={v => patch({ healthValidDays: v })}
      />
      <PrimaryButton
        label="Save settings" icon="check" disabled={!dirty} loading={save.isPending} style={{ marginTop: SP.sm }}
        onPress={() => save.mutate(s, {
          onSuccess: () => show({ type: 'success', message: 'Settings saved.' }),
          onError: e => showAlert('Could not save', apiErrorText(e)),
        })}
      />
    </Section>
  );
}

function WaiverRow({ waiver: w, onEdit }: { waiver: AdminWaiver; onEdit: () => void }) {
  const update = useUpdateWaiver();
  const total = w.versions.reduce((n, v) => n + v.signatureCount, 0);
  const toggle = async () => {
    if (w.isActive) {
      const ok = await confirm({
        title: 'Stop using this waiver?', confirmLabel: 'Deactivate', destructive: true,
        message: 'Members will no longer be asked to sign it, and it will no longer block bookings. Existing signatures are kept.',
      });
      if (!ok) return;
    }
    update.mutate({ waiverId: w.id, isActive: !w.isActive }, { onError: e => showAlert('Could not update', apiErrorText(e)) });
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingVertical: SP.md, gap: SP.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.sm }}>
        <Text style={{ flex: 1, color: T.text, fontSize: 16, fontWeight: '700' }} numberOfLines={2}>{w.title}</Text>
        <StatusPill label={w.isActive ? 'Active' : 'Inactive'} dot />
      </View>
      <Text style={{ color: T.textSub, fontSize: 13 }}>
        Version {w.latestVersion} · {total} signature{total === 1 ? '' : 's'} · created {fmtDay(w.createdAt)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SP.sm }}>
        <SmallButton icon="edit-2" label="Edit (new version)" onPress={onEdit} />
        <SmallButton icon={w.isActive ? 'pause-circle' : 'play-circle'} label={w.isActive ? 'Deactivate' : 'Activate'}
          tone={w.isActive ? T.err : T.brand} onPress={toggle} busy={update.isPending} />
      </View>
      {w.versions.map(v => (
        <Text key={v.id} style={{ color: T.textFaint, fontSize: 12 }}>
          v{v.version} · {fmtDay(v.publishedAt)} · {v.signatureCount} signed{v.version > 1 ? (v.requiresResign ? ' · re-sign required' : ' · minor change') : ''}
        </Text>
      ))}
    </View>
  );
}

function WaiverEditor({ editing, onClose }: { editing: NonNullable<Editing>; onClose: () => void }) {
  const isNew = editing.mode === 'new';
  const template = useWaiverTemplate(isNew);
  const create = useCreateWaiver();
  const publish = usePublishWaiverVersion();
  const { show } = useToast();
  const [title, setTitle] = useState(isNew ? '' : editing.waiver.title);
  const [body, setBody] = useState(isNew ? '' : editing.waiver.latestBody);
  const [requiresResign, setRequiresResign] = useState(true);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (isNew && template.data && !title && !body) { setTitle(template.data.title); setBody(template.data.body); }
  }, [isNew, template.data, title, body]);

  const busy = create.isPending || publish.isPending;
  const hasPlaceholder = /PLACEHOLDER|\[GYM LEGAL NAME\]/i.test(body);

  const submit = async () => {
    if (hasPlaceholder) {
      const ok = await confirm({
        title: 'The text still has placeholders',
        message: 'It contains "[PLACEHOLDER …]" or "[GYM LEGAL NAME]". Publish anyway? Members will see it exactly as written.',
        confirmLabel: 'Publish anyway',
      });
      if (!ok) return;
    }
    const done = () => { show({ type: 'success', message: isNew ? 'Waiver published.' : 'New version published.' }); onClose(); };
    const fail = (e: unknown) => showAlert('Could not publish', apiErrorText(e));
    if (isNew) create.mutate({ title, body }, { onSuccess: done, onError: fail });
    else publish.mutate({ waiverId: editing.waiver.id, title, body, requiresResign }, { onSuccess: done, onError: fail });
  };

  return (
    <Screen>
      <ScreenHeader eyebrow={isNew ? 'New waiver' : `Version ${editing.waiver.latestVersion + 1}`} title={isNew ? 'Create waiver' : 'Edit waiver'} onBack={onClose}
        action={{ label: preview ? 'Edit' : 'Preview', icon: preview ? 'edit-2' : 'eye', onPress: () => setPreview(p => !p) }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl, maxWidth: 760, width: '100%', alignSelf: 'center', gap: SP.md }}>
          <Notice icon="alert-triangle" tone={T.brandGold} title="Have a lawyer review this">
            The starting text is a placeholder, not legal advice. Waiver rules differ by country and state — get it checked before members sign.
          </Notice>
          {!isNew && (
            <Notice icon="info" tone={T.sky}>
              Signed versions never change. Saving publishes a new version; members' existing signatures stay on record.
            </Notice>
          )}
          {isNew && template.isLoading ? <LoadingState label="Loading template" /> : preview ? (
            <View style={{ backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line, padding: SP.lg }}>
              <Text style={{ color: T.text, fontSize: 20, fontWeight: '800', marginBottom: SP.md }}>{title}</Text>
              <WaiverText body={body} />
            </View>
          ) : (
            <View>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="Liability waiver and release" />
              <Text style={{ color: T.textSub, fontSize: 13, marginBottom: 7 }}>Waiver text (## heading, - bullet, **bold**)</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Waiver text"
                placeholderTextColor={T.textFaint}
                style={{
                  minHeight: 360, color: T.text, fontSize: 14, lineHeight: 21, padding: SP.md,
                  backgroundColor: T.bgInput, borderRadius: R.md, borderWidth: 1, borderColor: T.line,
                }}
              />
            </View>
          )}
          {!isNew && (
            <SwitchRow
              label="Members must sign again"
              description="Turn off only for small wording fixes. When on, members who signed an older version can't book until they sign this one."
              value={requiresResign}
              onValueChange={setRequiresResign}
            />
          )}
          <PrimaryButton label={isNew ? 'Publish waiver' : 'Publish new version'} icon="upload" onPress={submit} loading={busy}
            disabled={title.trim().length < 3 || body.trim().length < 20} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
