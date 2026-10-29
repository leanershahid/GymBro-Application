import React, { useState } from 'react';
import MemberBillingSection from '../../billing/components/MemberBillingSection';
import {
  View, Text, ScrollView, Pressable, Image, TextInput, Alert, Linking, RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  useMember, useMemberTrainers, useMemberNotes, useAddMemberNote, useMemberDocuments,
  useUploadMemberDocument, useMemberSubscriptions, useMemberAttendance, useUnassignTrainer,
} from '../api/memberQueries';
import { MemberDetail, AssignedTrainer } from '../types/member.types';
import AssignTrainerSheet from '../components/AssignTrainerSheet';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import StatusPill, { toneForStatus } from '../../common/components/StatusPill';
import LoadingState from '../../common/components/LoadingState';
import PrimaryButton from '../../common/components/PrimaryButton';
import EmptyState from '../../dashboard/components/EmptyState';
import ManageUserAccessPage from '../../module-access/pages/ManageUserAccessPage';
import { useToast } from '../../common/components/Toast';
import { describeApiError, apiErrorText } from '../../../api/apiError';
import { T, SP, R, withAlpha, Shadow } from '../../../theme';

type Tab = 'overview' | 'plans' | 'visits' | 'notes' | 'docs';
type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'plans',    label: 'Billing' },
  { key: 'visits',   label: 'Visits' },
  { key: 'notes',    label: 'Notes' },
  { key: 'docs',     label: 'Docs' },
];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtMoney = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount}`; }
};

// ─── Building blocks (same look as TrainerDetailPage) ────────────

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
      paddingHorizontal: SP.lg, marginBottom: SP.lg,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: SP.md, paddingBottom: 4 }}>
        <Text style={{ flex: 1, color: T.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: T.lineSubtle }} />;

function DetailRow({ icon, label, value }: { icon: FeatherIcon; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md }}>
      <View style={{
        width: 40, height: 40, borderRadius: R.md, backgroundColor: T.bgInputActive,
        alignItems: 'center', justifyContent: 'center', marginRight: SP.md,
      }}>
        <Feather name={icon} size={17} color={T.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function SmallButton({ icon, label, tone, onPress, disabled }: {
  icon: FeatherIcon; label: string; tone: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34,
        paddingHorizontal: 12, borderRadius: R.pill, opacity: disabled ? 0.5 : 1,
        backgroundColor: pressed ? withAlpha(tone, 0.18) : withAlpha(tone, 0.10),
        borderWidth: 1, borderColor: withAlpha(tone, 0.28),
      })}
    >
      <Feather name={icon} size={13} color={tone} />
      <Text style={{ color: tone, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Loading / error / empty switch shared by every tab. */
function TabState({ loading, error, empty, emptyIcon, emptyTitle, emptySubtitle, onRetry, loadingLabel }: {
  loading: boolean; error: unknown; empty: boolean; emptyIcon: FeatherIcon; emptyTitle: string;
  emptySubtitle?: string; onRetry: () => void; loadingLabel: string;
}) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) {
    return (
      <EmptyState
        icon="alert-triangle"
        tone="error"
        title="Couldn't load this"
        subtitle={describeApiError(error).message}
        action={{ label: 'Try again', onPress: onRetry }}
      />
    );
  }
  if (empty) return <EmptyState icon={emptyIcon} title={emptyTitle} subtitle={emptySubtitle} />;
  return null;
}

function ScanNote({ scanned, total, what }: { scanned: number; total: number; what: string }) {
  if (total <= scanned) return null;
  return (
    <View style={{
      flexDirection: 'row', gap: SP.sm, alignItems: 'flex-start', marginBottom: SP.md,
      backgroundColor: withAlpha(T.sky, 0.07), borderWidth: 1, borderColor: withAlpha(T.sky, 0.2),
      borderRadius: R.md, padding: SP.md,
    }}>
      <Feather name="info" size={14} color={T.sky} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: T.textSub, fontSize: 12, lineHeight: 17 }}>
        Showing matches from the latest {scanned} of {total.toLocaleString('en-IN')} gym {what}. Older history isn’t shown.
      </Text>
    </View>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────

function OverviewTab({ m, canEdit, onAssign, onRemoveTrainer, onManageAccess }: {
  m: MemberDetail; canEdit: boolean;
  onAssign: () => void; onRemoveTrainer: (t: AssignedTrainer) => void; onManageAccess: () => void;
}) {
  const trainersQ = useMemberTrainers(m.id);
  const trainers = trainersQ.data ?? [];

  return (
    <>
      <Section title="Profile">
        <DetailRow icon="mail" label="Email" value={m.email} />
        <Divider />
        <DetailRow icon="phone" label="Phone" value={m.phone || 'Not set'} />
        <Divider />
        <DetailRow icon="map-pin" label="Branch" value={m.branchName || 'Not set'} />
        <Divider />
        <DetailRow icon="user" label="Gender" value={m.gender ? capitalize(m.gender.toLowerCase()) : 'Not set'} />
        <Divider />
        <DetailRow icon="gift" label="Date of birth" value={m.dob ? fmtDate(m.dob) : 'Not set'} />
        <Divider />
        <DetailRow icon="calendar" label="Member since" value={fmtDate(m.createdAt)} />
      </Section>

      <Section
        title="Trainer"
        right={canEdit && !trainersQ.isLoading && !trainersQ.isError ? (
          <SmallButton icon="repeat" label={trainers.length ? 'Change' : 'Assign'} tone={T.brand} onPress={onAssign} />
        ) : undefined}
      >
        {trainersQ.isLoading ? (
          <LoadingState label="Finding trainer" />
        ) : trainersQ.isError ? (
          <EmptyState
            icon="alert-triangle" tone="error" title="Couldn't load trainer"
            subtitle={describeApiError(trainersQ.error).message}
            action={{ label: 'Try again', onPress: () => trainersQ.refetch() }}
          />
        ) : trainers.length === 0 ? (
          <View style={{ paddingVertical: SP.md, gap: SP.sm }}>
            <Text style={{ color: m.needsNewTrainer ? T.err : T.textSub, fontSize: 14 }}>
              {m.needsNewTrainer ? 'Trainer removed — needs reassignment.' : 'No trainer assigned.'}
            </Text>
          </View>
        ) : (
          trainers.map((t, i) => (
            <View key={t.trainerId}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md }}>
                <View style={{
                  width: 40, height: 40, borderRadius: R.md, backgroundColor: withAlpha(T.sky, 0.1),
                  alignItems: 'center', justifyContent: 'center', marginRight: SP.md,
                }}>
                  <Feather name="award" size={17} color={T.sky} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{t.displayName}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>Assigned {fmtDate(t.assignedAt)}</Text>
                </View>
                {canEdit && (
                  <SmallButton icon="user-minus" label="Remove" tone={T.err} onPress={() => onRemoveTrainer(t)} />
                )}
              </View>
            </View>
          ))
        )}
      </Section>

      {!!m.notes && (
        <Section title="Admin notes">
          <Text style={{ color: T.textSub, fontSize: 13, lineHeight: 20, paddingVertical: SP.md }}>{m.notes}</Text>
        </Section>
      )}

      {canEdit && (
        <PrimaryButton label="Manage app access" icon="shield" variant="secondary" onPress={onManageAccess} />
      )}
    </>
  );
}

function VisitsTab({ memberId }: { memberId: number }) {
  const q = useMemberAttendance(memberId);
  const items = q.data?.items ?? [];
  return (
    <>
      <TabState
        loading={q.isLoading} error={q.isError ? q.error : null} empty={!items.length}
        emptyIcon="log-in" emptyTitle="No recent visits" loadingLabel="Loading visits"
        emptySubtitle="No check-ins for this member in the recent gym log." onRetry={() => q.refetch()}
      />
      {!!q.data && !!items.length && <ScanNote scanned={q.data.scanned} total={q.data.total} what="check-ins" />}
      {!!items.length && (
        <Section title={`Recent visits · ${items.length}`}>
          {items.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, gap: SP.md }}>
                <Feather name={a.checkOutAt ? 'check-circle' : 'clock'} size={16} color={a.checkOutAt ? T.ok : T.brandGold} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }}>{fmtDateTime(a.checkInAt)}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {[a.branchName, capitalize(a.method)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600' }}>
                  {a.durationMin != null ? `${a.durationMin} min` : a.checkOutAt ? '—' : 'In gym'}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      )}
    </>
  );
}

function NotesTab({ memberId }: { memberId: number }) {
  const q = useMemberNotes(memberId);
  const add = useAddMemberNote(memberId);
  const [draft, setDraft] = useState('');
  const { show: showToast } = useToast();
  const notes = q.data ?? [];

  const submit = () => {
    const note = draft.trim();
    if (!note) return;
    add.mutate(note, {
      onSuccess: () => { setDraft(''); showToast({ type: 'success', message: 'Note added.' }); },
      onError: (e) => showToast({ type: 'error', message: describeApiError(e).message }),
    });
  };

  return (
    <>
      <View style={{
        backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
        padding: SP.md, marginBottom: SP.lg,
      }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a note about this member…"
          placeholderTextColor={T.textFaint}
          multiline
          maxLength={2000}
          accessibilityLabel="New note"
          style={{ color: T.text, fontSize: 14, minHeight: 64, textAlignVertical: 'top', padding: 4 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SP.sm }}>
          <SmallButton
            icon="send" label={add.isPending ? 'Saving…' : 'Add note'} tone={T.brand}
            onPress={submit} disabled={!draft.trim() || add.isPending}
          />
        </View>
      </View>

      <TabState
        loading={q.isLoading} error={q.isError ? q.error : null} empty={!notes.length}
        emptyIcon="file-text" emptyTitle="No notes yet" loadingLabel="Loading notes"
        emptySubtitle="Notes you add are visible to staff only." onRetry={() => q.refetch()}
      />
      {notes.map(n => (
        <View key={n.id} style={{
          backgroundColor: T.bgInput, borderRadius: R.lg, borderWidth: 1, borderColor: T.line,
          padding: SP.lg, marginBottom: SP.md,
        }}>
          <Text style={{ color: T.text, fontSize: 14, lineHeight: 20 }}>{n.note}</Text>
          <Text style={{ color: T.textFaint, fontSize: 11, marginTop: SP.sm }}>{fmtDateTime(n.createdAt)}</Text>
        </View>
      ))}
    </>
  );
}

function DocsTab({ memberId, canEdit }: { memberId: number; canEdit: boolean }) {
  const q = useMemberDocuments(memberId);
  const upload = useUploadMemberDocument(memberId);
  const { show: showToast } = useToast();
  const docs = q.data ?? [];

  // expo-document-picker isn't installed, so documents are limited to images for now.
  const pickAndUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    upload.mutate(
      { file: { uri: a.uri, mimeType: a.mimeType, fileName: a.fileName }, documentType: 'image' },
      {
        onSuccess: (r) => showToast({ type: r.success ? 'success' : 'error', message: r.success ? 'Document uploaded.' : r.message }),
        onError: (e) => Alert.alert('Upload failed', apiErrorText(e)),
      },
    );
  };

  const open = (url: string) => Linking.openURL(url).catch(() => showToast({ type: 'error', message: 'Could not open this file.' }));

  return (
    <>
      {canEdit && (
        <PrimaryButton
          label="Upload image document" icon="upload" variant="secondary"
          onPress={pickAndUpload} loading={upload.isPending} style={{ marginBottom: SP.lg }}
        />
      )}
      <TabState
        loading={q.isLoading} error={q.isError ? q.error : null} empty={!docs.length}
        emptyIcon="folder" emptyTitle="No documents" loadingLabel="Loading documents"
        emptySubtitle="ID proofs, waivers and medical forms appear here." onRetry={() => q.refetch()}
      />
      {!!docs.length && (
        <Section title={`Documents · ${docs.length}`}>
          {docs.map((d, i) => (
            <View key={d.id}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={() => open(d.url)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${d.fileName}`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: SP.md, gap: SP.md }}
              >
                <View style={{
                  width: 40, height: 40, borderRadius: R.md, backgroundColor: T.bgInputActive,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Feather name={d.documentType === 'image' ? 'image' : 'file'} size={17} color={T.brand} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: T.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{d.fileName}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>
                    {[d.documentType && capitalize(d.documentType), fmtDate(d.uploadedAt)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Feather name="external-link" size={16} color={T.textFaint} />
              </Pressable>
            </View>
          ))}
        </Section>
      )}
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────

interface Props {
  memberId: number;
  onBack: () => void;
  onEdit?: () => void;
  canEdit?: boolean;
  /** Opens the "new membership" flow for this member (billing access only). */
  onNewMembership?: () => void;
}

export default function MemberDetailPage({ memberId, onBack, onEdit, canEdit = false, onNewMembership }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [assignOpen, setAssignOpen] = useState(false);
  const [manageAccess, setManageAccess] = useState(false);
  const { data: member, isLoading, isError, error, refetch, isRefetching } = useMember(memberId);
  const trainersQ = useMemberTrainers(memberId, canEdit);
  const unassign = useUnassignTrainer();
  const { show: showToast } = useToast();

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Member" title="Loading…" onBack={onBack} />
        <LoadingState label="Loading member" />
      </Screen>
    );
  }

  if (isError || !member) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Member" title="Member" onBack={onBack} />
        <EmptyState
          icon="alert-triangle"
          tone="error"
          title="Couldn't load member"
          subtitle={isError ? describeApiError(error).message : 'This member was not found.'}
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      </Screen>
    );
  }

  const fullName = `${member.firstName} ${member.lastName}`;

  if (manageAccess) {
    return <ManageUserAccessPage userId={member.id} userName={fullName} onBack={() => setManageAccess(false)} />;
  }

  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();

  const removeTrainer = (t: AssignedTrainer) => {
    Alert.alert(
      'Remove trainer?',
      `${t.displayName} will no longer be assigned to ${fullName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => unassign.mutate(
            { memberId: member.id, trainerId: t.trainerId },
            {
              onSuccess: () => showToast({ type: 'success', message: `${t.displayName} removed.` }),
              onError: (e) => Alert.alert('Could not remove trainer', apiErrorText(e)),
            },
          ),
        },
      ],
    );
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Member"
        title={fullName}
        onBack={onBack}
        action={canEdit && onEdit ? { label: 'Edit', icon: 'edit-2', onPress: onEdit } : undefined}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: SP.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={T.brand} />}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', marginTop: SP.sm, marginBottom: SP.lg }}>
          {member.avatarUrl ? (
            <Image
              source={{ uri: member.avatarUrl }}
              accessibilityLabel={`${fullName} photo`}
              style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: withAlpha(T.brand, 0.4) }}
            />
          ) : (
            <View style={[{
              width: 92, height: 92, borderRadius: 46, backgroundColor: T.brand,
              alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: withAlpha(T.brand, 0.4),
            }, Shadow.neon]}>
              <Text style={{ color: T.onBrand, fontSize: 30, fontWeight: '800' }}>{initials}</Text>
            </View>
          )}
          <Text style={{ color: T.text, fontSize: 21, fontWeight: '800', marginTop: SP.md, letterSpacing: -0.3 }}>{fullName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <StatusPill label={capitalize(member.status)} tone={toneForStatus(member.status)} dot />
            {!!member.branchName && <StatusPill label={member.branchName} tone="neutral" />}
          </View>
          <View style={{ alignItems: 'center', marginTop: SP.sm, gap: 2 }}>
            {!!member.phone && <Text style={{ color: T.textSub, fontSize: 13 }}>{member.phone}</Text>}
            <Text style={{ color: T.textFaint, fontSize: 13 }}>{member.email}</Text>
          </View>
          {member.needsNewTrainer && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SP.md,
              backgroundColor: withAlpha(T.err, 0.08), borderWidth: 1, borderColor: withAlpha(T.err, 0.25),
              borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 7,
            }}>
              <Feather name="alert-triangle" size={12} color={T.err} />
              <Text style={{ color: T.err, fontSize: 12, fontWeight: '700' }}>Trainer removed — needs reassignment</Text>
            </View>
          )}
        </View>

        <SegmentedTabs<Tab> tabs={TABS} value={tab} onChange={setTab} style={{ marginBottom: SP.lg }} />

        {tab === 'overview' && (
          <OverviewTab
            m={member}
            canEdit={canEdit}
            onAssign={() => setAssignOpen(true)}
            onRemoveTrainer={removeTrainer}
            onManageAccess={() => setManageAccess(true)}
          />
        )}
        {tab === 'plans'  && (
          <MemberBillingSection memberId={member.id} memberName={`${member.firstName} ${member.lastName}`.trim()} onNewMembership={onNewMembership} />
        )}
        {tab === 'visits' && <VisitsTab memberId={member.id} />}
        {tab === 'notes'  && <NotesTab memberId={member.id} />}
        {tab === 'docs'   && <DocsTab memberId={member.id} canEdit={canEdit} />}
      </ScrollView>

      {canEdit && (
        <AssignTrainerSheet
          visible={assignOpen}
          onClose={() => setAssignOpen(false)}
          memberId={member.id}
          memberName={fullName}
          currentTrainers={trainersQ.data ?? []}
        />
      )}
    </Screen>
  );
}
