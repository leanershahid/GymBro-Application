import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../../theme';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useMembers } from '../../members/api/memberQueries';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SegmentedTabs from '../../common/components/SegmentedTabs';
import SearchBar from '../../common/components/SearchBar';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
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
    <Screen>
      <ScreenHeader eyebrow="Access control" title="Feature Access" onBack={onBack} />

      <View className="px-5 pb-4">
        <SegmentedTabs<Tab>
          tabs={[{ key: 'trainers', label: 'Trainers' }, { key: 'clients', label: 'Clients' }]}
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 14 }}
        />
        <SearchBar value={search} onChangeText={setSearch} placeholder={'Search ' + tab + '…'} />
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {isLoading ? (
          <LoadingState label={'Loading ' + tab} />
        ) : rows.length === 0 ? (
          <EmptyState icon="users" title={'No ' + tab + ' found'} />
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
    </Screen>
  );
}
