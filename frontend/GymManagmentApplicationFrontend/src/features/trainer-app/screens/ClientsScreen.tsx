import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, FlatList, ListRenderItemInfo,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { showAlert } from '../../common/components/dialogs';
import { Feather } from '@expo/vector-icons';
import {
  useMyClients, useClientProfile, useClientProfiles, useClientTimeline,
  useClientNotes, useAddClientNote, useTrainerProfile,
} from '../api/trainerAppQueries';
import ClientPreviewRow from '../components/ClientPreviewRow';
import { ClientAssignment } from '../types/trainer-app.types';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import Avatar from '../../common/components/Avatar';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../common/components/EmptyState';

// ─── Client detail ─────────────────────────────────────────────────
function ClientDetail({ trainerId, clientId, onBack }: { trainerId: number; clientId: number; onBack: () => void }) {
  const { data: profile, isLoading } = useClientProfile(clientId);
  const { data: assignedTrainer }    = useTrainerProfile(profile?.trainerId ?? 0);
  const { data: timeline = [] }      = useClientTimeline(clientId);
  const { data: notes = [], refetch: refetchNotes } = useClientNotes(clientId);
  const { mutate: addNote, isPending: adding } = useAddClientNote();

  const [noteText, setNoteText] = useState('');
  const [tab, setTab]           = useState<'overview' | 'timeline' | 'notes'>('overview');

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote({ memberId: clientId, note: noteText.trim(), trainerId }, {
      onSuccess: () => { setNoteText(''); refetchNotes(); showAlert('✓', 'Note added.'); },
      onError:   () => showAlert('Error', 'Failed to add note.'),
    });
  };

  if (isLoading) return <LoadingState fullScreen label="Loading client" />;

  const fullName = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() : '';

  return (
    <Screen>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Nav */}
      <ScreenHeader
        eyebrow="Client"
        title={fullName || profile?.email || 'Client details'}
        onBack={onBack}
      />

      {/* Avatar + info */}
      <View style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}>
        <Avatar uri={profile?.avatarUrl} size={68} borderColor={T.brand} borderWidth={2} label={fullName ? `${fullName} photo` : undefined} style={{ marginBottom: 10 }} />
        {profile && <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 13 }}>{profile.email}</Text>}
        {profile?.status && (
          <View style={{ marginTop: 8, alignSelf: 'center' }}>
            <StatusPill label={profile.status} tone="brand" />
          </View>
        )}
      </View>

      {/* Tab switcher */}
      <SegmentedTabs
        tabs={[{ key: 'overview', label: 'Overview' }, { key: 'timeline', label: 'Timeline' }, { key: 'notes', label: 'Notes' }]}
        value={tab}
        onChange={setTab}
        style={{ marginHorizontal: 20, marginBottom: 16 }}
      />

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Overview */}
        {tab === 'overview' && profile && (
          <View style={{ gap: 10 }}>
            {[
              { label: 'Phone',   value: profile.phone ?? '—' },
              { label: 'Gender',  value: profile.gender ?? '—' },
              { label: 'DOB',     value: profile.dob ?? '—' },
              { label: 'Trainer', value: assignedTrainer?.displayName || '—' },
              { label: 'Branch',  value: profile.branchName || '—' },
            ].map(row => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.bgInputActive }}>
                <Text style={{ color: T.textSub, fontSize: 12, width: 80 }}>{row.label}</Text>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Timeline */}
        {tab === 'timeline' && (
          <View>
            {timeline.length === 0 ? (
              <EmptyState icon="clock" title="No activity yet" />
            ) : (
              timeline.slice(0, 20).map((ev, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: withAlpha(T.brand, 0.10), borderWidth: 1, borderColor: withAlpha(T.brand, 0.22), alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                    <Feather name="zap" size={13} color={T.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>{ev.description}</Text>
                    <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 3 }}>
                      {new Date(ev.occurredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Notes */}
        {tab === 'notes' && (
          <View>
            {/* Add note */}
            <TextInput
              accessibilityLabel="New note about this client"
              style={{ backgroundColor: T.bgInput, borderRadius: 16, borderWidth: 1, borderColor: T.line, color: T.text, padding: 14, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 10 }}
              value={noteText} onChangeText={setNoteText}
              placeholder="Add a note about this client…" placeholderTextColor={T.textFaint}
              multiline
            />
            <PrimaryButton
              label="Add Note"
              onPress={handleAddNote}
              loading={adding}
              disabled={!noteText.trim()}
              style={{ marginBottom: 24 }}
            />

            {/* Existing notes */}
            {notes.length === 0 ? (
              <EmptyState icon="edit-3" title="No notes yet" />
            ) : (
              notes.map(n => (
                <View key={n.id} style={{ backgroundColor: T.bgInput, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: T.bgInputActive }}>
                  <Text style={{ color: T.text, fontSize: 13, lineHeight: 20 }}>{n.note}</Text>
                  <Text style={{ color: T.textFaint, fontSize: 11, marginTop: 6 }}>
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── Clients list ──────────────────────────────────────────────────
const clientKey = (c: ClientAssignment) => String(c.assignmentId);
const RowGap = () => <View style={{ height: 10 }} />;
interface Props {
  trainerId: number;
  /** Open straight into this client's detail (e.g. tapped from the Today screen). */
  initialClientId?: number;
  onBack?: () => void;
}

export default function ClientsScreen({ trainerId, initialClientId, onBack }: Props) {
  const [selectedClient, setSelectedClient] = useState<number | null>(initialClientId ?? null);
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading, isError, refetch } = useMyClients(trainerId);
  // ARCH-068: there is no batch profile endpoint yet, so every profile is one request. Rows fetch
  // their own profile only once FlatList renders them (virtualised); the whole roster's profiles are
  // fetched only when the trainer actually searches. Backend follow-up: return name/email with
  // GET trainers/{id}/clients so neither is needed.
  const searching = search.trim().length > 0;
  const profileQueries = useClientProfiles(searching ? clients.map(c => c.clientId) : []);

  // Search matches the client's real name or email (only profiles that have loaded can match).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((_, i) => {
      const p = profileQueries[i]?.data;
      if (!p) return false;
      return `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase().includes(q)
        || (p.email ?? '').toLowerCase().includes(q);
    });
  }, [clients, profileQueries, search]);

  const renderClient = useCallback(({ item, index }: ListRenderItemInfo<ClientAssignment>) => (
    <ClientPreviewRow client={item} index={index} onPress={() => setSelectedClient(item.clientId)} />
  ), []);

  if (selectedClient !== null) {
    return <ClientDetail trainerId={trainerId} clientId={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <Screen>

      <ScreenHeader eyebrow="Roster" title="My Clients" onBack={onBack} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>

        {!isLoading && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {[{ l: 'Total', v: clients.length }, { l: 'Active', v: clients.filter(c => c.status === 'Active').length }, { l: 'Shown', v: filtered.length }].map(s => (
              <View key={s.l} accessible accessibilityLabel={`${s.l}: ${s.v}`} style={{ flex: 1, backgroundColor: T.bgInput, borderRadius: R.lg, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: T.bgInputActive }}>
                <Text style={{ color: T.brand, fontSize: 18, fontWeight: '800' }}>{s.v}</Text>
                <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600' }}>{s.l}</Text>
              </View>
            ))}
          </View>
        )}

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name or email…" label="Search clients by name or email" />
      </View>

      <ScrollView style={{ flex: filtered.length > 0 && !isLoading && !isError ? 0 : 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        {isLoading && <Skeleton rows={3} height={72} />}
        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load clients" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState icon="users" title={search ? 'No results' : 'No clients assigned yet'} />
        )}
      </ScrollView>
      {!isLoading && !isError && filtered.length > 0 && (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={clientKey}
          renderItem={renderClient}
          initialNumToRender={10}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          ItemSeparatorComponent={RowGap}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
