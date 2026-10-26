import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMembers } from '../api/memberQueries';
import { Member } from '../types/member.types';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import StatusPill, { toneForStatus } from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import Skeleton from '../../common/components/Skeleton';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import ManageUserAccessPage from '../../module-access/pages/ManageUserAccessPage';
import { T, withAlpha, SP } from '../../../theme';

const TINTS = [T.brand, T.sky, T.violet, T.brandGold, T.err];
const tint  = (id: number) => TINTS[id % TINTS.length];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function MemberCard({ member, onPress }: { member: Member; onPress: () => void }) {
  const accent   = tint(member.id);
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();
  const fullName = `${member.firstName} ${member.lastName}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${fullName}, ${member.status}`}
      accessibilityHint="Opens access management for this member"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: pressed ? T.bgInputActive : T.bgInput,
        borderRadius: 18, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: pressed ? withAlpha(T.brand, 0.20) : T.bgInputActive,
      })}
    >
      {/* Avatar */}
      <View style={{
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: withAlpha(accent, 0.09),
        borderWidth: 1.5, borderColor: withAlpha(accent, 0.31),
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14,
      }}>
        <Text style={{ color: accent, fontSize: 16, fontWeight: '800' }}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <Text className="text-white font-bold text-[15px]" numberOfLines={1}>
          {fullName}
        </Text>
        <Text className="text-sub text-[12px] mt-0.5" numberOfLines={1}>{member.email}</Text>
        {!!member.phone && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Feather name="phone" size={11} color={T.textFaint} />
            <Text className="text-faint text-[11px]" numberOfLines={1}>{member.phone}</Text>
          </View>
        )}
      </View>

      {/* Right */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <StatusPill label={capitalize(member.status)} tone={toneForStatus(member.status)} dot />
        {/* Show trainer badge if assigned */}
        {!!member.trainerId && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: withAlpha(T.sky, 0.10), borderWidth: 1, borderColor: withAlpha(T.sky, 0.25), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Feather name="award" size={11} color={T.sky} />
            <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>T#{member.trainerId}</Text>
          </View>
        )}
        <Text className="text-faint text-[11px]" numberOfLines={1}>
          {new Date(member.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      </View>
    </Pressable>
  );
}

interface Props { onBack?: () => void; onAddMember?: () => void; }

export default function ViewMembersPage({ onBack, onAddMember }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [manageAccessFor, setManageAccessFor] = useState<Member | null>(null);

  const { data: paged, isLoading, isError, isFetching, refetch } = useMembers(search, page, 20);
  const items      = paged?.items        ?? [];
  const totalPages = paged?.totalPages   ?? 1;
  const totalRecs  = paged?.totalRecords ?? 0;

  if (manageAccessFor) {
    return (
      <ManageUserAccessPage
        userId={manageAccessFor.id}
        userName={`${manageAccessFor.firstName} ${manageAccessFor.lastName}`}
        onBack={() => setManageAccessFor(null)}
      />
    );
  }

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Members"
        title="All Members"
        onBack={onBack}
        action={onAddMember ? { label: 'Add', icon: 'plus', onPress: onAddMember } : undefined}
      />

      <View style={{ paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        {/* Stats row */}
        {!isLoading && !isError && (
          <View style={{ marginBottom: SP.lg }}>
            <StatsStrip items={[
              { icon: 'users',        label: 'Total',  value: String(totalRecs),                                                          accent: T.brand },
              { icon: 'check-circle', label: 'Active', value: String(items.filter(m => m.status.toLowerCase() === 'active').length),     accent: T.sky },
              { icon: 'eye',          label: 'Shown',  value: String(items.length),                                                       accent: T.violet },
            ]} />
          </View>
        )}

        {/* Search (+ background-refresh spinner) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <SearchBar
            value={search}
            onChangeText={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search by name or email…"
            label="Search members"
            style={{ flex: 1 }}
          />
          {isFetching && !isLoading && (
            <ActivityIndicator size="small" color={T.brand} accessibilityLabel="Refreshing" />
          )}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={isLoading || isError ? [] : items}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <MemberCard member={item} onPress={() => setManageAccessFor(item)} />}
        ListHeaderComponent={
          isLoading ? <Skeleton height={74} /> :
          isError ? (
            <EmptyState
              icon="wifi-off"
              tone="error"
              title="Failed to load"
              subtitle="Check your connection and try again."
              action={{ label: 'Retry', onPress: () => refetch() }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="users"
              title={search ? 'No results' : 'No members yet'}
              subtitle={search ? `Nothing matches "${search}"` : 'Add your first member to get started.'}
            />
          ) : null
        }
        ListFooterComponent={
          !isLoading && !isError
            ? <PaginationFooter page={page} totalPages={totalPages} onChange={setPage} />
            : null
        }
        contentContainerStyle={{ paddingHorizontal: SP.xl, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
