import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  Platform, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useMyClients, useClientProfile, useClientTimeline,
  useClientNotes, useAddClientNote,
} from '../api/trainerAppQueries';
import { ClientAssignment } from '../types/trainer-app.types';
import { T, R, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import Skeleton from '../../common/components/Skeleton';
import StatusPill from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';

const COLORS = [T.brand, T.sky, T.violet, T.brandGold, T.err];

// ─── Client detail ─────────────────────────────────────────────────
function ClientDetail({ trainerId, clientId, onBack }: { trainerId: number; clientId: number; onBack: () => void }) {
  const { data: profile, isLoading } = useClientProfile(clientId);
  const { data: timeline = [] }      = useClientTimeline(clientId);
  const { data: notes = [], refetch: refetchNotes } = useClientNotes(clientId);
  const { mutate: addNote, isPending: adding } = useAddClientNote();

  const [noteText, setNoteText] = useState('');
  const [tab, setTab]           = useState<'overview' | 'timeline' | 'notes'>('overview');

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote({ memberId: clientId, note: noteText.trim(), trainerId }, {
      onSuccess: () => { setNoteText(''); refetchNotes(); Alert.alert('✓', 'Note added.'); },
      onError:   () => Alert.alert('Error', 'Failed to add note.'),
    });
  };

  if (isLoading) return <LoadingState fullScreen label="Loading client" />;

  const initials = `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || `#${clientId}`;

  return (
    <Screen>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Nav */}
      <ScreenHeader
        eyebrow="Client"
        title={profile ? `${profile.firstName} ${profile.lastName}` : `Client #${clientId}`}
        onBack={onBack}
      />

      {/* Avatar + info */}
      <View style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: withAlpha(T.brand, 0.12), borderWidth: 2, borderColor: T.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ color: T.brand, fontSize: 22, fontWeight: '800' }}>{initials}</Text>
        </View>
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
              { label: 'Trainer', value: profile.trainerId ? `#${profile.trainerId}` : '—' },
              { label: 'Branch',  value: profile.branchId  ? `#${profile.branchId}`  : '—' },
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
interface Props { trainerId: number; onBack?: () => void; }

export default function ClientsScreen({ trainerId, onBack }: Props) {
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading, isError, refetch } = useMyClients(trainerId);

  if (selectedClient !== null) {
    return <ClientDetail trainerId={trainerId} clientId={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  const filtered = search.trim() ? clients.filter(c => String(c.clientId).includes(search)) : clients;

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

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by client ID…" label="Search clients by ID" />
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && <Skeleton rows={3} height={72} />}
        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Failed to load clients" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState icon="users" title={search ? 'No results' : 'No clients assigned yet'} />
        )}
        {!isLoading && !isError && filtered.map((c, i) => {
          const col = COLORS[i % COLORS.length];
          return (
            <Pressable key={c.assignmentId} onPress={() => setSelectedClient(c.clientId)}
              accessibilityRole="button"
              accessibilityLabel={`Client #${c.clientId}, ${c.status}`}
              accessibilityHint="Opens client details"
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: pressed ? T.bgInputActive : T.bgInput,
                borderRadius: 18, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: pressed ? withAlpha(T.brand, 0.20) : T.bgInputActive,
              })}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: withAlpha(col, 0.09), borderWidth: 1.5, borderColor: withAlpha(col, 0.31), alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Text numberOfLines={1} style={{ color: col, fontSize: 14, fontWeight: '800' }}>#{c.clientId}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, fontWeight: '700' }}>Client #{c.clientId}</Text>
                <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>
                  Assigned {new Date(c.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <StatusPill label={c.status} tone={c.status === 'Active' ? 'brand' : 'neutral'} />
                <Feather name="chevron-right" size={14} color={T.textFaint} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
