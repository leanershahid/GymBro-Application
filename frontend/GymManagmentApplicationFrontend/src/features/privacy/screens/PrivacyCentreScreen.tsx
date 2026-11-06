import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../common/components/EmptyState';
import PrimaryButton from '../../common/components/PrimaryButton';
import StatusPill, { PillTone } from '../../common/components/StatusPill';
import { SwitchRow } from '../../common/components/FormFields';
import { confirm, showAlert } from '../../common/components/dialogs';
import { apiErrorText, describeApiError } from '../../../api/apiError';
import { useMyConsents, useRecordConsent } from '../../safety/api/safetyQueries';
import { ConsentType } from '../../safety/api/safety.types';
import { useExportLink, useKeepMyAccount, usePrivacyOverview, useRequestDataExport } from '../api/privacyQueries';
import { DataExport, PrivacyOverview } from '../api/privacy.types';
import DeleteAccountFlow from '../components/DeleteAccountFlow';
import { Card, Notice, fmtDate, fmtDateTime, fmtSize, openLink } from '../components/PrivacyUi';

interface Props {
  onBack: () => void;
  onSignOut: () => void;
  /** Opens a member screen that fixes a deletion blocker ("billing", "shop/orders"). */
  onOpenRoute?: (route: string) => void;
}

/** Consents grouped by what they're for, each with a plain explanation. Terms / privacy acceptance is shown, not toggled here. */
const CONSENT_GROUPS: { title: string; rows: { type: ConsentType; label: string; description: string }[] }[] = [
  {
    title: 'Your health',
    rows: [{ type: 'health_data', label: 'Keep my health answers',
      description: 'Lets the gym store your health check so trainers can keep you safe. Turning it off may stop you booking classes.' }],
  },
  {
    title: 'News & offers',
    rows: [
      { type: 'marketing_email', label: 'By email', description: 'Promotions, events and gym news. Booking and billing emails still come.' },
      { type: 'marketing_push', label: 'By notification', description: 'Offers and events on your phone. Class reminders still come.' },
    ],
  },
  {
    title: 'Photos & videos',
    rows: [{ type: 'photo_media', label: 'Use photos I appear in',
      description: 'The gym may share photos or videos of you on its social channels and website.' }],
  },
];

const EXPORT_TONE: Record<string, PillTone> = { preparing: 'info', queued: 'info', ready: 'ok', expired: 'neutral', failed: 'err' };
const EXPORT_LABEL: Record<string, string> = { preparing: 'Preparing', queued: 'Preparing', ready: 'Ready', expired: 'Expired', failed: 'Failed' };

/**
 * Profile → "Privacy & data": consents, download my data, delete my account, and the gym's policy
 * links. Delete sits on this screen like every other setting — no extra hoops beyond re-entering
 * the password.
 */
export default function PrivacyCentreScreen({ onBack, onSignOut, onOpenRoute }: Props) {
  const q = usePrivacyOverview();
  const [deleting, setDeleting] = useState(false);

  return (
    <Screen>
      <ScreenHeader eyebrow="Profile" title="Privacy & data" onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl * 2, maxWidth: 640, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={T.brand} />}
        >
          {q.isLoading ? <LoadingState label="Loading your privacy settings" /> : q.isError || !q.data ? (
            <EmptyState icon="alert-triangle" tone="error" title="Couldn't load your privacy settings"
              subtitle={describeApiError(q.error).message} action={{ label: 'Try again', onPress: () => q.refetch() }} />
          ) : deleting ? (
            <DeleteAccountFlow overview={q.data} onCancel={() => setDeleting(false)} onSignOut={onSignOut} onOpenRoute={onOpenRoute} />
          ) : (
            <>
              <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20, marginBottom: SP.lg }}>
                Choose what the gym may use, get a copy of your data, or delete your account.
              </Text>
              <PendingNotice overview={q.data} />
              <ConsentsCard />
              <ExportCard overview={q.data} />
              <DeleteCard overview={q.data} onStart={() => setDeleting(true)} />
              <PolicyCard overview={q.data} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PendingNotice({ overview }: { overview: PrivacyOverview }) {
  const keep = useKeepMyAccount();
  const p = overview.pendingDeletion;
  if (!p) return null;
  return (
    <Notice tone={p.status === 'blocked' ? 'warn' : 'danger'}
      title={p.status === 'blocked' ? 'Your deletion request is on hold' : `Your account will be deleted on ${fmtDate(p.scheduledFor)}`}>
      <View style={{ gap: SP.sm }}>
        <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 19 }}>
          {p.status === 'blocked' ? p.blockedReason ?? 'Something needs sorting first.' : 'Changed your mind? You can keep it.'}
        </Text>
        <PrimaryButton label="Keep my account" icon="shield" loading={keep.isPending}
          onPress={() => keep.mutate(undefined, {
            onSuccess: () => showAlert('Your account is safe', 'We won’t delete it.'),
            onError: e => showAlert('Couldn’t keep your account', apiErrorText(e)),
          })} />
      </View>
    </Notice>
  );
}

function ConsentsCard() {
  const consentsQ = useMyConsents();
  const record = useRecordConsent();
  const current = consentsQ.data?.current ?? [];

  const toggle = async (type: ConsentType, granted: boolean) => {
    if (!granted && type === 'health_data') {
      const ok = await confirm({
        title: 'Stop keeping your health answers?',
        message: 'The gym will no longer use your health check. You may need to agree again to book classes.',
        confirmLabel: 'Turn off', destructive: true,
      });
      if (!ok) return;
    }
    record.mutate({ type, granted }, { onError: e => showAlert('Couldn’t save', apiErrorText(e)) });
  };

  const accepted = (type: ConsentType) => current.find(c => c.type === type);
  return (
    <Card title="What the gym may use" subtitle="You can change these any time. Each change is saved with the date.">
      {consentsQ.isLoading ? <LoadingState label="Loading consents" /> : consentsQ.isError ? (
        <EmptyState icon="alert-triangle" tone="error" title="Couldn't load consents"
          subtitle={describeApiError(consentsQ.error).message} action={{ label: 'Try again', onPress: () => consentsQ.refetch() }} />
      ) : (
        <View>
          {CONSENT_GROUPS.map(g => (
            <View key={g.title}>
              <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: SP.sm }}>{g.title}</Text>
              {g.rows.map(row => {
                const cur = current.find(c => c.type === row.type);
                return (
                  <SwitchRow key={row.type} label={row.label}
                    description={cur?.at ? `${row.description} ${cur.granted ? 'On' : 'Off'} since ${fmtDate(cur.at)}.` : row.description}
                    value={!!cur?.granted} onValueChange={v => toggle(row.type, v)} />
                );
              })}
            </View>
          ))}
          {(['terms', 'privacy'] as const).map(t => {
            const a = accepted(t);
            return a?.granted ? (
              <Text key={t} style={{ color: T.textFaint, fontSize: 12, lineHeight: 18 }}>
                You accepted the {t === 'terms' ? 'terms' : 'privacy policy'} (version {a.version ?? '1'}) on {fmtDate(a.at)}.
              </Text>
            ) : null;
          })}
        </View>
      )}
    </Card>
  );
}

function ExportRow({ e }: { e: DataExport }) {
  const link = useExportLink();
  const download = () => link.mutate(e.id, {
    onSuccess: l => openLink(l.url),
    onError: err => showAlert('Couldn’t download', apiErrorText(err)),
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 56, borderTopWidth: 1, borderTopColor: T.line, paddingVertical: SP.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 14 }}>Requested {fmtDateTime(e.requestedAt)}</Text>
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
          {e.status === 'ready' ? `Available until ${fmtDate(e.expiresAt)}${e.sizeBytes ? ` · ${fmtSize(e.sizeBytes)}` : ''}`
            : e.status === 'expired' ? 'The link has expired. Ask for a new copy.'
            : e.status === 'failed' ? 'Something went wrong. Please ask again.'
            : 'We’re putting it together. We’ll notify you when it’s ready.'}
        </Text>
      </View>
      {e.status === 'ready' ? (
        <PrimaryButton label="Download" icon="download" variant="secondary" loading={link.isPending} onPress={download}
          accessibilityHint="Opens your data file (a ZIP with data.json and a readable summary)" />
      ) : (
        <StatusPill label={EXPORT_LABEL[e.status] ?? e.status} tone={EXPORT_TONE[e.status] ?? 'neutral'} />
      )}
    </View>
  );
}

function ExportCard({ overview }: { overview: PrivacyOverview }) {
  const start = useRequestDataExport();
  const waitUntil = overview.nextExportAt && new Date(overview.nextExportAt) > new Date() ? overview.nextExportAt : null;
  return (
    <Card title="Download my data"
      subtitle="Get a copy of everything the gym holds about you: profile, memberships, invoices, check-ins, bookings, workouts, health answers, consents, orders and posts.">
      <PrimaryButton label="Prepare my data" icon="download-cloud" variant="secondary" loading={start.isPending}
        disabled={!!waitUntil}
        onPress={() => start.mutate(undefined, {
          onSuccess: () => showAlert('We’re on it', 'We’ll notify you and email you when your file is ready. It usually takes a few minutes.'),
          onError: e => showAlert('Couldn’t start', apiErrorText(e)),
        })} />
      {!!waitUntil && (
        <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm }}>You can ask once a day. Next: {fmtDateTime(waitUntil)}.</Text>
      )}
      <Text style={{ color: T.textFaint, fontSize: 12, marginTop: SP.sm, marginBottom: overview.exports.length ? SP.sm : 0 }}>
        For your security, each download link works for 7 days.
      </Text>
      {overview.exports.map(e => <ExportRow key={e.id} e={e} />)}
    </Card>
  );
}

function DeleteCard({ overview, onStart }: { overview: PrivacyOverview; onStart: () => void }) {
  const pending = overview.pendingDeletion?.status === 'pending';
  return (
    <Card title="Delete my account" tone="danger"
      subtitle={`Your personal details are deleted ${overview.links.graceDays} days after you ask. You can change your mind until then.`}>
      <PrimaryButton label={pending ? `Deletion scheduled for ${fmtDate(overview.pendingDeletion!.scheduledFor)}` : 'Delete my account'}
        icon="trash-2" variant="danger" disabled={pending} onPress={onStart}
        accessibilityHint="Shows what will be deleted and asks you to confirm" />
    </Card>
  );
}

function LinkRow({ label, url }: { label: string; url?: string | null }) {
  return (
    <Pressable onPress={url ? () => openLink(url) : undefined} disabled={!url}
      accessibilityRole="link" accessibilityLabel={url ? label : `${label} (not published yet)`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, borderTopWidth: 1, borderTopColor: T.line }}>
      <Feather name="file-text" size={18} color={T.textSub} />
      <Text style={{ flex: 1, color: url ? T.text : T.textFaint, fontSize: 15 }}>{label}</Text>
      {url ? <Feather name="external-link" size={16} color={T.textFaint} /> : <Text style={{ color: T.textFaint, fontSize: 12 }}>Not published yet</Text>}
    </Pressable>
  );
}

function PolicyCard({ overview }: { overview: PrivacyOverview }) {
  return (
    <Card title="Policies">
      <LinkRow label="Privacy policy" url={overview.links.privacyPolicyUrl} />
      <LinkRow label="Terms & conditions" url={overview.links.termsUrl} />
      <Text style={{ color: T.textFaint, fontSize: 12, lineHeight: 18, marginTop: SP.sm }}>
        Questions about your data? Ask the front desk — the gym is responsible for it.
      </Text>
    </Card>
  );
}
