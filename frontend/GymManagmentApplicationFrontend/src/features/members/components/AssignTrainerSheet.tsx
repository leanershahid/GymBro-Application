import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import BottomSheet from '../../common/components/BottomSheet';
import SearchBar from '../../common/components/SearchBar';
import LoadingState from '../../common/components/LoadingState';
import EmptyState from '../../dashboard/components/EmptyState';
import { useToast } from '../../common/components/Toast';
import { useTrainers } from '../../trainers/api/trainerQueries';
import { useAssignTrainer, useUnassignTrainer } from '../api/memberQueries';
import { AssignedTrainer } from '../types/member.types';
import { apiErrorText } from '../../../api/apiError';
import { T, SP, R, withAlpha } from '../../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  memberId: number;
  memberName: string;
  /** Trainers currently assigned to the member (replaced when a new one is picked). */
  currentTrainers: AssignedTrainer[];
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

/** Pick a trainer for a member (assign / change) or remove the current one. */
export default function AssignTrainerSheet({ visible, onClose, memberId, memberName, currentTrainers }: Props) {
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);
  const { data: page, isLoading, isError, refetch } = useTrainers(1, 100);
  const assign = useAssignTrainer();
  const unassign = useUnassignTrainer();
  const { show: showToast } = useToast();

  const currentIds = useMemo(() => new Set(currentTrainers.map(t => t.trainerId)), [currentTrainers]);
  const busy = assign.isPending || unassign.isPending;

  const trainers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = page?.items ?? [];
    return q
      ? all.filter(t => [t.displayName, t.email, t.trainerCode, ...(t.specializations ?? [])]
          .some(v => v?.toLowerCase().includes(q)))
      : all;
  }, [page, search]);

  const close = () => { if (!busy) { setSearch(''); onClose(); } };

  const pick = (trainerId: number, name: string) => {
    if (busy || currentIds.has(trainerId)) return;
    setPendingId(trainerId);
    assign.mutate(
      { memberId, trainerId, replace: [...currentIds] },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: `${name} is now ${memberName}’s trainer.` });
          setSearch('');
          onClose();
        },
        onError: (e) => Alert.alert('Could not assign trainer', apiErrorText(e)),
        onSettled: () => setPendingId(null),
      },
    );
  };

  const remove = (t: AssignedTrainer) => {
    Alert.alert(
      'Remove trainer?',
      `${t.displayName} will no longer be assigned to ${memberName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => unassign.mutate(
            { memberId, trainerId: t.trainerId },
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
    <BottomSheet visible={visible} onClose={close} title={currentTrainers.length ? 'Change trainer' : 'Assign trainer'}>
      <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search trainers…" label="Search trainers" />
      </View>

      {/* Current assignment(s) with a Remove action */}
      {currentTrainers.length > 0 && (
        <View style={{ paddingHorizontal: SP.xl, paddingTop: SP.md, gap: SP.sm }}>
          {currentTrainers.map(t => (
            <View key={t.trainerId} style={{
              flexDirection: 'row', alignItems: 'center', gap: SP.sm,
              backgroundColor: withAlpha(T.sky, 0.08), borderWidth: 1, borderColor: withAlpha(T.sky, 0.25),
              borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: SP.sm,
            }}>
              <Feather name="award" size={14} color={T.sky} />
              <Text style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                Current: {t.displayName}
              </Text>
              <Pressable
                onPress={() => remove(t)}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${t.displayName}`}
                style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: SP.sm, opacity: busy ? 0.5 : 1 }}
              >
                {unassign.isPending
                  ? <ActivityIndicator size="small" color={T.err} />
                  : <Text style={{ color: T.err, fontSize: 13, fontWeight: '700' }}>Remove</Text>}
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{ padding: SP.xl, paddingTop: SP.md, gap: SP.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && <LoadingState label="Loading trainers" />}
        {isError && (
          <EmptyState icon="wifi-off" tone="error" title="Couldn't load trainers" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}
        {!isLoading && !isError && trainers.length === 0 && (
          <EmptyState
            icon="users"
            title={search ? 'No matching trainers' : 'No trainers yet'}
            subtitle={search ? `Nothing matches "${search}"` : undefined}
          />
        )}
        {trainers.map(t => {
          const current = currentIds.has(t.id);
          const loading = pendingId === t.id && assign.isPending;
          return (
            <Pressable
              key={t.id}
              onPress={() => pick(t.id, t.displayName)}
              disabled={busy || current}
              accessibilityRole="button"
              accessibilityLabel={`${t.displayName}${current ? ', current trainer' : ''}`}
              accessibilityState={{ selected: current, disabled: busy || current }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: SP.md,
                padding: SP.md, borderRadius: R.lg, borderWidth: 1,
                borderColor: current ? withAlpha(T.brand, 0.45) : T.line,
                backgroundColor: current ? withAlpha(T.brand, 0.08) : pressed ? T.bgInputActive : T.bg,
                opacity: busy && !loading ? 0.6 : 1,
              })}
            >
              <View style={{
                width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                backgroundColor: withAlpha(T.sky, 0.10), borderWidth: 1, borderColor: withAlpha(T.sky, 0.3),
              }}>
                <Text style={{ color: T.sky, fontWeight: '800', fontSize: 14 }}>{initials(t.displayName)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: T.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{t.displayName}</Text>
                <Text style={{ color: T.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {[t.trainerCode, t.specializations?.slice(0, 2).join(', ')].filter(Boolean).join(' · ') || t.email}
                </Text>
              </View>
              {loading ? <ActivityIndicator size="small" color={T.brand} />
                : current ? <Feather name="check-circle" size={18} color={T.brand} />
                : !t.isAvailable ? <Text style={{ color: T.textFaint, fontSize: 11, fontWeight: '700' }}>Unavailable</Text>
                : <Feather name="chevron-right" size={18} color={T.textFaint} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}
