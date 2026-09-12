import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useMembers } from '../../members/api/memberQueries';
import BackButton from '../../common/components/BackButton';
import ManageUserAccessPage from './ManageUserAccessPage';

interface Props { onBack?: () => void; }

type Tab = 'trainers' | 'clients';

interface PersonRow { userId: number; name: string; subtitle: string }

export default function UserAccessListPage({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>('trainers');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PersonRow | null>(null);

  const { data: trainerPage, isLoading: trainersLoading } = useTrainers(1, 100);
  const { data: memberPage, isLoading: membersLoading } = useMembers(search, 1, 100);

  if (selected) {
    return (
      <ManageUserAccessPage
        userId={selected.userId}
        userName={selected.name}
        onBack={() => setSelected(null)}
      />
    );
  }

  const trainerRows: PersonRow[] = (trainerPage?.items ?? [])
    .filter(t => !search.trim() || t.displayName.toLowerCase().includes(search.toLowerCase()))
    .map(t => ({ userId: t.userId, name: t.displayName, subtitle: t.employment?.designation ?? 'Trainer' }));

  const clientRows: PersonRow[] = (memberPage?.items ?? [])
    .map(m => ({ userId: m.id, name: `${m.firstName} ${m.lastName}`, subtitle: m.email }));

  const rows = tab === 'trainers' ? trainerRows : clientRows;
  const isLoading = tab === 'trainers' ? trainersLoading : membersLoading;

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View className="px-5 pt-5 pb-4">
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Access control
            </Text>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>Feature Access</Text>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: T.bgInput, borderRadius: 14, padding: 4, marginBottom: 14 }}>
          {(['trainers', 'clients'] as Tab[]).map(t => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center', backgroundColor: active ? T.brand : 'transparent' }}
              >
                <Text style={{ color: active ? T.onBrand : T.textSub, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bgInput, borderRadius: 14, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: T.line }}>
          <Feather name="search" size={15} color={T.textFaint} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, color: T.text, fontSize: 14 }}
            placeholder={`Search ${tab}…`}
            placeholderTextColor={T.textFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading ? (
          <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />
        ) : rows.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Feather name="users" size={28} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 14, marginTop: 12 }}>No {tab} found</Text>
          </View>
        ) : (
          rows.map(row => (
            <Pressable
              key={row.userId}
              onPress={() => setSelected(row)}
              accessibilityRole="button"
              accessibilityLabel={`Manage access for ${row.name}`}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: T.bgInput, borderRadius: 16, padding: 14, marginBottom: 10,
                borderWidth: 1, borderColor: T.line,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{row.name}</Text>
                <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{row.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={T.textFaint} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
