import React, { useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTrainers, useSetTrainerStatus, useDeleteTrainer } from '../api/trainerQueries';
import { TrainerSummary } from '../types/trainer.types';
import { T, withAlpha, R, SP } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import SearchBar from '../../common/components/SearchBar';
import StatusPill from '../../common/components/StatusPill';
import PaginationFooter from '../../common/components/PaginationFooter';
import EmptyState from '../../dashboard/components/EmptyState';
import StatsStrip from '../../common/StatsStrip';
import Skeleton from '../../common/components/Skeleton';
import TrainerDetailPage from './TrainerDetailPage';
import { useToast } from '../../common/components/Toast';
import { useModuleCan } from '../../module-access/context/ModuleAccessContext';

const TINTS = [
  { bg: withAlpha(T.sky, 0.08),  accent: T.sky },
  { bg: withAlpha(T.brand, 0.08),   accent: T.brand },
  { bg: withAlpha(T.violet, 0.08), accent: T.violet },
  { bg: withAlpha(T.brandGold, 0.08),  accent: T.brandGold },
];
const tint = (id: number) => TINTS[id % TINTS.length];

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

// ─── Trainer card ─────────────────────────────────────────────────
function TrainerCard({
  trainer, onPress, onToggleStatus, onRemove, canEdit, canDelete,
}: {
  trainer: TrainerSummary;
  onPress: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const c        = tint(trainer.id);
  const initials = trainer.displayName
    .split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const designation = trainer.employment?.designation ?? '';
  const department  = trainer.employment?.department  ?? '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trainer.displayName}, ${trainer.isAvailable ? 'available' : 'unavailable'}`}
      accessibilityHint="Opens this trainer's details"
      style={({ pressed }) => ({
        marginBottom: 14,
        borderRadius: R.xl,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
        backgroundColor: withAlpha(T.ok, 0.06),
        borderWidth: 1,
        borderColor: withAlpha(T.ok, 0.18),
        shadowColor: T.ok,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 8,
      })}
    >
      {/* Accent top strip */}
      <View style={{ height: 3, backgroundColor: c.accent, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl }} />

      <View style={{ padding: 16 }}>
        {/* Top row — avatar + name + badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: c.bg,
            borderWidth: 1.5, borderColor: withAlpha(c.accent, 0.38),
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            <Text style={{ color: c.accent, fontSize: 20, fontWeight: '800' }}>{initials}</Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={{ color: T.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 }} numberOfLines={1}>
              {trainer.displayName}
            </Text>
            {(designation || department) ? (
              <Text style={{ color: T.textSub, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {designation}{department ? ` · ${department}` : ''}
              </Text>
            ) : (
              <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }}>No designation</Text>
            )}
          </View>

          <StatusPill label={trainer.isAvailable ? 'Available' : 'Unavailable'} tone={trainer.isAvailable ? 'brand' : 'err'} dot />
        </View>

        {/* Code pill + experience */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{
            backgroundColor: c.bg, borderWidth: 1, borderColor: withAlpha(c.accent, 0.25),
            borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text numberOfLines={1} style={{ color: c.accent, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
              {trainer.trainerCode || '—'}
            </Text>
          </View>

          {trainer.experienceYears !== null && trainer.experienceYears !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="award" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>
                {trainer.experienceYears}yr{trainer.experienceYears !== 1 ? 's' : ''} exp
              </Text>
            </View>
          )}

          {trainer.rating !== null && trainer.rating !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="star" size={12} color={T.brandGold} />
              <Text style={{ color: T.textSub, fontSize: 12 }}>{trainer.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: withAlpha(T.ok, 0.12), marginBottom: 12 }} />

        {/* Specializations */}
        {!!trainer.specializations?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {trainer.specializations.slice(0, 3).map((s) => (
              <View key={s} style={{
                backgroundColor: withAlpha(T.text, 0.05),
                borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
                borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{ color: T.textSub, fontSize: 11 }} numberOfLines={1}>{s}</Text>
              </View>
            ))}
            {trainer.specializations.length > 3 && (
              <View style={{
                backgroundColor: withAlpha(T.text, 0.05),
                borderWidth: 1, borderColor: withAlpha(T.text, 0.10),
                borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{ color: T.textFaint, fontSize: 11 }}>+{trainer.specializations.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Contact row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
            <Feather name="mail" size={12} color={T.textFaint} />
            <Text style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>{trainer.email}</Text>
          </View>
          {!!trainer.phone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather name="phone" size={12} color={T.textFaint} />
              <Text style={{ color: T.textSub, fontSize: 12 }} numberOfLines={1}>{trainer.phone}</Text>
            </View>
          )}
        </View>

        {/* Actions — hidden entirely when this account has no edit/delete access to trainers */}
        {(canEdit || canDelete) && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {canEdit && (
              <ActionButton
                icon={trainer.isAvailable ? 'user-x' : 'user-check'}
                label={trainer.isAvailable ? 'Deactivate' : 'Activate'}
                tone={trainer.isAvailable ? T.brandGold : T.ok}
                onPress={onToggleStatus}
              />
            )}
            {canDelete && (
              <ActionButton icon="trash-2" label="Remove" tone={T.err} onPress={onRemove} />
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
interface ViewTrainersPageProps {
  onBack?: () => void;
  onAddTrainer?: () => void;
}

const PAGE_SIZE = 20;

export default function ViewTrainersPage({ onBack, onAddTrainer }: ViewTrainersPageProps) {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerSummary | null>(null);

  const { data: paged, isLoading, isError, isFetching, refetch } = useTrainers(page, PAGE_SIZE);
  const { mutate: setStatus } = useSetTrainerStatus();
  const { mutate: removeTrainer } = useDeleteTrainer();
  const { show: showToast } = useToast();
  const canEditTrainers = useModuleCan('trainers', 'edit');
  const canDeleteTrainers = useModuleCan('trainers', 'delete');

  if (selectedTrainer) {
    return (
      <TrainerDetailPage
        trainer={selectedTrainer}
        onBack={() => setSelectedTrainer(null)}
      />
    );
  }

  const handleToggleStatus = (trainer: TrainerSummary) => {
    const isActive = trainer.isAvailable;
    Alert.alert(
      isActive ? 'Deactivate trainer?' : 'Activate trainer?',
      isActive
        ? `${trainer.displayName} will no longer be able to sign in, and their assigned members will be flagged as needing a new trainer.`
        : `${trainer.displayName} will be able to sign in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isActive ? 'Deactivate' : 'Activate',
          style: isActive ? 'destructive' : 'default',
          onPress: () => setStatus(
            { id: trainer.id, isActive: !isActive },
            {
              onSuccess: (res) => showToast({ type: res.success ? 'success' : 'error', message: res.message ?? 'Done.' }),
              onError: () => showToast({ type: 'error', message: 'Could not update status.' }),
            },
          ),
        },
      ],
    );
  };

  const handleRemove = (trainer: TrainerSummary) => {
    Alert.alert(
      'Remove trainer?',
      `${trainer.displayName} will be archived and can no longer sign in. Their assigned members will be flagged as needing a new trainer. This can't be undone from here.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeTrainer(trainer.id, {
            onSuccess: (res) => showToast({ type: res.success ? 'success' : 'error', message: res.message ?? 'Done.' }),
            onError: () => showToast({ type: 'error', message: 'Could not remove trainer.' }),
          }),
        },
      ],
    );
  };

  const items        = paged?.items        ?? [];
  const totalRecords = paged?.totalRecords;
  const totalPages   = paged?.totalPages   ?? 1;

  const filtered = items.filter((t) =>
    search.trim() === '' ||
    t.displayName.toLowerCase().includes(search.toLowerCase()) ||
    t.trainerCode?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );


  const listHeader = (
    <>
      {/* Summary strip */}
      {!isLoading && !isError && (
        <View style={{ marginBottom: 24 }}>
          <StatsStrip items={[
            { icon: 'award', label: 'Total',        value: totalRecords == null ? '—' : totalRecords.toLocaleString('en-IN'), accent: T.sky },
            { icon: 'eye',   label: search.trim() ? 'Matching on page' : 'On this page', value: String(filtered.length), accent: T.violet },
          ]} />
        </View>
      )}

      {/* Loading */}
      {isLoading && <Skeleton rows={3} height={165} borderRadius={R.xl} />}

      {/* Error */}
      {isError && (
        <EmptyState
          icon="wifi-off"
          tone="error"
          title="Failed to load"
          subtitle="Check your connection and try again."
          action={{ label: 'Retry', onPress: () => refetch() }}
        />
      )}
    </>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Staff"
        title="All Trainers"
        onBack={onBack}
        action={onAddTrainer ? { label: 'Add', icon: 'plus', onPress: onAddTrainer } : undefined}
      />

      {/* Search (+ background-refresh spinner) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SP.md, paddingHorizontal: SP.xl, paddingBottom: SP.lg }}>
        <SearchBar
          value={search}
          onChangeText={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, code or email…"
          label="Search trainers"
          style={{ flex: 1 }}
        />
        {isFetching && !isLoading && (
          <ActivityIndicator size="small" color={T.brand} accessibilityLabel="Refreshing" />
        )}
      </View>

      <FlatList
        data={isLoading || isError ? [] : filtered}
        keyExtractor={(t) => String(t.id)}
        renderItem={({ item }) => (
          <TrainerCard
            trainer={item}
            onPress={() => setSelectedTrainer(item)}
            onToggleStatus={() => handleToggleStatus(item)}
            onRemove={() => handleRemove(item)}
            canEdit={canEditTrainers}
            canDelete={canDeleteTrainers}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !isLoading && !isError ? (
            <EmptyState
              icon="award"
              title={search ? 'No results' : 'No trainers yet'}
              subtitle={search ? `Nothing matches "${search}"` : 'Onboard your first trainer to get started.'}
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
