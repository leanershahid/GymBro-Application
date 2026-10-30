import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import StatusPill from '../../common/components/StatusPill';
import { useMembers } from '../../members/api/memberQueries';
import { Member } from '../../members/types/member.types';

interface Props {
  visible: boolean;
  /** Sheet title — says what picking a member does ("Find a member", "Check in", …). */
  title: string;
  onClose: () => void;
  onPick: (member: Member) => void;
  /** Busy indicator on the row being acted on (e.g. while checking in). */
  busyId?: number | null;
}

/** Search members by name, email or phone and pick one — the admin's global search and every "for a member" action. */
export default function MemberPickerSheet({ visible, title, onClose, onPick, busyId }: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  const { data, isLoading, isError, refetch } = useMembers(debounced, 1, 20);
  const members = data?.items ?? [];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Name, email or phone" />
      </View>
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
        {isLoading && <ActivityIndicator color={T.brand} style={{ marginVertical: 20 }} />}
        {isError && (
          <Pressable onPress={() => refetch()} accessibilityRole="button" style={{ padding: 20, minHeight: 44 }}>
            <Text style={{ color: T.err, fontSize: 14 }}>Couldn't load members. Tap to retry.</Text>
          </Pressable>
        )}
        {!isLoading && !isError && members.length === 0 && (
          <Text style={{ color: T.textSub, fontSize: 14, padding: 20 }}>
            {debounced ? `No member matches "${debounced}".` : 'No members yet.'}
          </Text>
        )}
        {members.map(m => {
          const name = `${m.firstName} ${m.lastName}`.trim() || m.email;
          return (
            <Pressable
              key={m.id}
              onPress={() => onPick(m)}
              disabled={busyId != null}
              accessibilityRole="button"
              accessibilityLabel={name}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60,
                paddingHorizontal: 20, paddingVertical: 8, backgroundColor: pressed ? T.bgInputActive : 'transparent',
              })}
            >
              {m.avatarUrl
                ? <Image source={{ uri: m.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(T.brand, 0.14) }}>
                    <Text style={{ color: T.brand, fontWeight: '800' }}>{(m.firstName?.[0] ?? '') + (m.lastName?.[0] ?? '')}</Text>
                  </View>
                )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>{name}</Text>
                <Text numberOfLines={1} style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>{m.phone || m.email}</Text>
              </View>
              {busyId === m.id
                ? <ActivityIndicator size="small" color={T.brand} />
                : m.status ? <StatusPill label={m.status} /> : <Feather name="chevron-right" size={18} color={T.textFaint} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
