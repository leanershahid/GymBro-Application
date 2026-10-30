import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMembers, useDeleteMember, useSetMemberStatus } from '../api/memberQueries';
import { useTrainers } from '../../trainers/api/trainerQueries';
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
import { useToast } from '../../common/components/Toast';
import { useRoleModuleAccess } from '../../module-access/hooks/useRoleModuleAccess';
import { T, withAlpha, SP, R } from '../../../theme';

const TINTS = [T.brand, T.sky, T.violet, T.brandGold, T.err];
const tint  = (id: number) => TINTS[id % TINTS.length];

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function ActionButton({
  icon, label, tone, onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  tone: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill,
        backgroundColor: pressed ? withAlpha(tone, 0.18) : withAlpha(tone, 0.10),
        borderWidth: 1, borderColor: withAlpha(tone, 0.28),
      })}
    >
      <Feather name={icon} size={12} color={tone} />
      <Text style={{ color: tone, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function MemberCard({
  member, trainerName, onPress, pressHint, onManageAccess, onToggleStatus, onRemove, canEdit, canDelete,
}: {
  member: Member;
  trainerName?: string;
  onPress: () => void;
  pressHint: string;
  /** Secondary "Access" action, shown when the row itself opens the member's detail page. */
  onManageAccess?: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const accent   = tint(member.id);
  const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase();
  const fullName = `${member.firstName} ${member.lastName}`;
  const isActive = member.status.toLowerCase() === 'active';

  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: 18, padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: member.needsNewTrainer ? withAlpha(T.err, 0.35) : T.bgInputActive,
    }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${fullName}, ${member.status}`}
        accessibilityHint={pressHint}
        style={{ flexDirection: 'row', alignItems: 'center' }}
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
          {/* Show the assigned trainer's name (hidden until it's known) */}
          {!!member.trainerId && !!trainerName && (
            <View accessibilityLabel={`Trainer ${trainerName}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140, backgroundColor: withAlpha(T.sky, 0.10), borderWidth: 1, borderColor: withAlpha(T.sky, 0.25), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Feather name="award" size={11} color={T.sky} />
              <Text style={{ color: T.sky, fontSize: 11, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{trainerName}</Text>
            </View>
          )}
          <Text className="text-faint text-[11px]" numberOfLines={1}>
            {new Date(member.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </Pressable>

      {/* Reminder: this member's trainer was removed/deactivated */}
      {member.needsNewTrainer && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
          backgroundColor: withAlpha(T.err, 0.08), borderWidth: 1, borderColor: withAlpha(T.err, 0.25),
          borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 7,
        }}>
          <Feather name="alert-triangle" size={12} color={T.err} />
          <Text style={{ color: T.err, fontSize: 11, fontWeight: '700', flex: 1 }}>
            Trainer removed — needs reassignment
          </Text>
        </View>
      )}

      {/* Actions — hidden entirely when this account has no edit/delete access to members */}
      {(canEdit || canDelete) && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {canEdit && (
            <ActionButton
              icon={isActive ? 'user-x' : 'user-check'}
              label={isActive ? 'Deactivate' : 'Activate'}
              tone={isActive ? T.brandGold : T.ok}
              onPress={onToggleStatus}
            />
          )}
          {canDelete && (
            <ActionButton icon="trash-2" label="Remove" tone={T.err} onPress={onRemove} />
          )}
          {canEdit && onManageAccess && (
            <ActionButton icon="shield" label="Access" tone={T.sky} onPress={onManageAccess} />
          )}
        </View>
      )}
    </View>
  );
}

interface Props {
  onBack?: () => void;
  onAddMember?: () => void;
  /** When given, tapping a member opens their detail page (access management stays as a secondary action). */
  onOpenMember?: (id: number) => void;
}

export default function ViewMembersPage({ onBack, onAddMember, onOpenMember }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');   // debounced value that drives the query
  const [page, setPage]     = useState(1);
  const [manageAccessFor, setManageAccessFor] = useState<Member | null>(null);

  // Debounce typing so we don't fire a request per keystroke.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  const { data: paged, isLoading, isError, isFetching, refetch } = useMembers(search, page, 20);
  const items      = paged?.items        ?? [];
  const totalPages = paged?.totalPages   ?? 1;
  const totalRecs  = paged?.totalRecords;
  const { data: trainerPage } = useTrainers(1, 100);
  const trainerNames = useMemo(
    () => new Map((trainerPage?.items ?? []).map(t => [t.id, t.displayName])),
    [trainerPage],
  );

  const { mutate: setStatus } = useSetMemberStatus();
  const { mutate: removeMember } = useDeleteMember();
  const { show: showToast } = useToast();
  const membersAccess = useRoleModuleAccess('members');
  const canEditMembers = membersAccess.canEdit;
  const canDeleteMembers = membersAccess.canDelete;

  const handleToggleStatus = (member: Member) => {
    const isActive = member.status.toLowerCase() === 'active';
    const fullName = `${member.firstName} ${member.lastName}`;
    Alert.alert(
      isActive ? 'Deactivate member?' : 'Activate member?',
      isActive
        ? `${fullName} will no longer be able to sign in.`
        : `${fullName} will be able to sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Deactivate' : 'Activate',
          style: isActive ? 'destructive' : 'default',
          onPress: () => setStatus(
            { id: member.id, isActive: !isActive },
            {
              onSuccess: (res) => showToast({ type: res.success ? 'success' : 'error', message: res.message ?? 'Done.' }),
              onError: () => showToast({ type: 'error', message: 'Could not update status.' }),
            },
          ),
        },
      ],
    );
  };

  const handleRemove = (member: Member) => {
    const fullName = `${member.firstName} ${member.lastName}`;
    Alert.alert(
      'Remove member?',
      `${fullName} will be archived and can no longer sign in. This can't be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMember(member.id, {
            onSuccess: (res) => showToast({ type: res.success ? 'success' : 'error', message: res.message ?? 'Done.' }),
            onError: () => showToast({ type: 'error', message: 'Could not remove member.' }),
          }),
        },
      ],
    );
  };

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
              { icon: 'users', label: search.trim() ? 'Matching' : 'Total', value: totalRecs == null ? '—' : totalRecs.toLocaleString('en-IN'), accent: T.brand },
              { icon: 'eye',   label: 'On this page', value: String(items.length), accent: T.violet },
            ]} />
          </View>
        )}

        {/* Search (+ background-refresh spinner) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md }}>
          <SearchBar
            value={searchInput}
            onChangeText={setSearchInput}
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
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            trainerName={item.trainerId ? trainerNames.get(item.trainerId) : undefined}
            onPress={() => (onOpenMember ? onOpenMember(item.id) : setManageAccessFor(item))}
            pressHint={onOpenMember ? 'Opens this member’s details' : 'Opens access management for this member'}
            onManageAccess={onOpenMember ? () => setManageAccessFor(item) : undefined}
            onToggleStatus={() => handleToggleStatus(item)}
            onRemove={() => handleRemove(item)}
            canEdit={canEditMembers}
            canDelete={canDeleteMembers}
          />
        )}
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
