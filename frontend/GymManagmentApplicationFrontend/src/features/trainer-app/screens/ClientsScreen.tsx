import React, { useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useMyClients, useClientProfile, useClientTimeline,
  useClientNotes, useAddClientNote,
} from '../api/trainerAppQueries';
import { ClientAssignment } from '../types/trainer-app.types';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];
const COLORS = ['#7ED321', '#22D3EE', '#A78BFA', '#FACC15', '#F87171'];

function Skeleton({ h = 72 }: { h?: number }) {
  const op = useRef(new Animated.Value(0.25)).current;
  React.useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.65, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.25, duration: 700, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  return <>{[0,1,2].map(k => <Animated.View key={k} style={{ height: h, borderRadius: 18, backgroundColor: '#151915', marginBottom: 10, opacity: op }} />)}</>;
}

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

  if (isLoading) return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#7ED321" />
    </View>
  );

  const initials = `${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || `#${clientId}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      {/* Nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <Pressable onPress={onBack} hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Feather name="arrow-left" size={18} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>Client</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800' }} numberOfLines={1}>
            {profile ? `${profile.firstName} ${profile.lastName}` : `Client #${clientId}`}
          </Text>
        </View>
      </View>

      {/* Avatar + info */}
      <View style={{ alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 }}>
        <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(126,211,33,0.12)', borderWidth: 2, borderColor: '#7ED321', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#7ED321', fontSize: 22, fontWeight: '800' }}>{initials}</Text>
        </View>
        {profile && <Text style={{ color: '#AAAAAA', fontSize: 13 }}>{profile.email}</Text>}
        {profile?.status && (
          <View style={{ marginTop: 8, backgroundColor: 'rgba(126,211,33,0.10)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(126,211,33,0.25)' }}>
            <Text style={{ color: '#7ED321', fontSize: 11, fontWeight: '700' }}>{profile.status}</Text>
          </View>
        )}
      </View>

      {/* Tab switcher */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#151915', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#1C211C', marginBottom: 14 }}>
        {(['overview', 'timeline', 'notes'] as const).map(t => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: tab === t ? '#7ED321' : 'transparent' }}>
            <Text style={{ color: tab === t ? '#000' : '#AAAAAA', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

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
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1C211C' }}>
                <Text style={{ color: '#AAAAAA', fontSize: 12, width: 80 }}>{row.label}</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 }}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Timeline */}
        {tab === 'timeline' && (
          <View>
            {timeline.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 32 }}>
                <Feather name="clock" size={28} color="#444" />
                <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 10 }}>No activity yet</Text>
              </View>
            ) : (
              timeline.slice(0, 20).map((ev, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(126,211,33,0.10)', borderWidth: 1, borderColor: 'rgba(126,211,33,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                    <Feather name="zap" size={13} color="#7ED321" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{ev.description}</Text>
                    <Text style={{ color: '#666666', fontSize: 11, marginTop: 3 }}>
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
              style={{ backgroundColor: '#151915', borderRadius: 16, borderWidth: 1, borderColor: '#242B24', color: '#FFFFFF', padding: 14, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 10 }}
              value={noteText} onChangeText={setNoteText}
              placeholder="Add a note about this client…" placeholderTextColor="#555"
              multiline
            />
            <Pressable onPress={handleAddNote} disabled={adding || !noteText.trim()}
              style={{ backgroundColor: !noteText.trim() ? '#242B24' : '#7ED321', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginBottom: 20, opacity: adding ? 0.7 : 1 }}>
              {adding ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Add Note</Text>}
            </Pressable>

            {/* Existing notes */}
            {notes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 16 }}>
                <Feather name="edit-3" size={26} color="#444" />
                <Text style={{ color: '#AAAAAA', fontSize: 13, marginTop: 10 }}>No notes yet</Text>
              </View>
            ) : (
              notes.map(n => (
                <View key={n.id} style={{ backgroundColor: '#151915', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1C211C' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 20 }}>{n.note}</Text>
                  <Text style={{ color: '#555', fontSize: 11, marginTop: 6 }}>
                    {new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
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
    <View style={{ flex: 1, backgroundColor: '#0A0F0A', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F0A" />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#151915', borderWidth: 1, borderColor: '#242B24', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Roster</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>My Clients</Text>
          </View>
        </View>

        {!isLoading && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {[{ l: 'Total', v: clients.length }, { l: 'Active', v: clients.filter(c => c.status === 'Active').length }, { l: 'Shown', v: filtered.length }].map(s => (
              <View key={s.l} style={{ flex: 1, backgroundColor: '#151915', borderRadius: 16, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#1C211C' }}>
                <Text style={{ color: '#7ED321', fontSize: 18, fontWeight: '800' }}>{s.v}</Text>
                <Text style={{ color: '#AAAAAA', fontSize: 11, fontWeight: '600' }}>{s.l}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#151915', borderRadius: 14, borderWidth: 1, borderColor: '#242B24', paddingHorizontal: 12, height: 46 }}>
          <Feather name="search" size={15} color="#555" style={{ marginRight: 8 }} />
          <TextInput style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }} placeholder="Search by client ID…" placeholderTextColor="#555"
            value={search} onChangeText={setSearch} keyboardType="numeric" />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Feather name="x" size={14} color="#555" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {isLoading && <Skeleton />}
        {isError && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Feather name="wifi-off" size={28} color="#EF4444" />
            <Pressable onPress={() => refetch()} style={{ backgroundColor: '#7ED321', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, marginTop: 16 }}>
              <Text style={{ color: '#000', fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#151915', borderWidth: 1, borderColor: '#1C211C', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Feather name="users" size={28} color="#AAA" />
            </View>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{search ? 'No results' : 'No clients assigned yet'}</Text>
          </View>
        )}
        {!isLoading && !isError && filtered.map((c, i) => {
          const col = COLORS[i % COLORS.length];
          return (
            <Pressable key={c.assignmentId} onPress={() => setSelectedClient(c.clientId)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: pressed ? '#1C211C' : '#151915',
                borderRadius: 18, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: pressed ? 'rgba(126,211,33,0.20)' : '#1C211C',
              })}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: col + '18', borderWidth: 1.5, borderColor: col + '50', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Text style={{ color: col, fontSize: 14, fontWeight: '800' }}>#{c.clientId}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Client #{c.clientId}</Text>
                <Text style={{ color: '#AAAAAA', fontSize: 11, marginTop: 2 }}>
                  Assigned {new Date(c.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View style={{ backgroundColor: c.status === 'Active' ? 'rgba(126,211,33,0.12)' : '#1C211C', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: c.status === 'Active' ? 'rgba(126,211,33,0.28)' : '#242B24' }}>
                  <Text style={{ color: c.status === 'Active' ? '#7ED321' : '#AAAAAA', fontSize: 11, fontWeight: '700' }}>{c.status}</Text>
                </View>
                <Feather name="chevron-right" size={14} color="#555" />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
