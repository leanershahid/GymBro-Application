import React, { useState } from 'react';
import { currentTenantId } from '../../../api/session';
import {
  View, Text, ScrollView, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';
import Screen from '../../common/components/Screen';
import ScreenHeader from '../../common/components/ScreenHeader';
import PrimaryButton from '../../common/components/PrimaryButton';
import LoadingState from '../../common/components/LoadingState';
import SharedStatusPill, { PillTone } from '../../common/components/StatusPill';
import EmptyState from '../../dashboard/components/EmptyState';
import { Field } from '../../trainers/components/FormFields';
import { useChallenges, useCreateChallenge, useUpdateChallengeStatus } from '../api/challengeQueries';
import { ChallengeAdminResponse, ChallengeStatus, CreateChallengePayload } from '../types/challenge.types';



interface Props { onBack?: () => void; }

const STATUS_TONE: Record<ChallengeStatus, PillTone> = {
  Active: 'brand',
  Draft: 'neutral',
  Completed: 'info',
  Cancelled: 'err',
};

function StatusPill({ status }: { status: ChallengeStatus }) {
  return <SharedStatusPill label={status} tone={STATUS_TONE[status] ?? 'neutral'} />;
}

function formatDateRange(startsAt: string, endsAt: string) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

// ─── Create form ──────────────────────────────────────────────────
function CreateChallengeForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [prizeLabel, setPrizeLabel] = useState('');

  const { mutate: create, isPending } = useCreateChallenge();

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a challenge title.');
      return;
    }
    if (!startsAt.trim() || !endsAt.trim()) {
      Alert.alert('Missing dates', 'Please enter both a start and end date (YYYY-MM-DD).');
      return;
    }
    const payload: CreateChallengePayload = {
      tenantId: currentTenantId(),
      title: title.trim(),
      description: description.trim() || undefined,
      targetValue: targetValue.trim() ? Number(targetValue.trim()) : undefined,
      startsAt: `${startsAt.trim()}T00:00:00Z`,
      endsAt: `${endsAt.trim()}T00:00:00Z`,
      prizeLabel: prizeLabel.trim() || undefined,
    };
    create(payload, {
      onSuccess: () => onClose(),
      onError: () => Alert.alert('Error', 'Failed to create challenge.'),
    });
  };

  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: 20, padding: 16, marginBottom: 18,
      borderWidth: 1, borderColor: T.line,
    }}>
      <Text style={{ color: T.text, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>New challenge</Text>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. 30-Day Step Challenge" autoCapitalize="none" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional description" multiline autoCapitalize="none" />
      <Field label="Target value" value={targetValue} onChangeText={setTargetValue} placeholder="Optional numeric target" keyboardType="numeric" />
      <Field label="Start date" value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} />
      <Field label="End date" value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} />
      <Field label="Prize label" value={prizeLabel} onChangeText={setPrizeLabel} placeholder="Optional, e.g. Free month membership" autoCapitalize="none" />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1, paddingHorizontal: 12 }} />
        <PrimaryButton label="Create" onPress={handleSubmit} loading={isPending} style={{ flex: 1, paddingHorizontal: 12 }} />
      </View>
    </View>
  );
}

// ─── Challenge card ───────────────────────────────────────────────
function ChallengeCard({ challenge }: { challenge: ChallengeAdminResponse }) {
  const { mutate: setStatus, isPending } = useUpdateChallengeStatus();

  const handleAction = (status: ChallengeStatus) => {
    setStatus(
      { id: challenge.id, payload: { status } },
      { onError: () => Alert.alert('Error', `Failed to set status to ${status}.`) },
    );
  };

  return (
    <View style={{
      backgroundColor: T.bgInput, borderRadius: 20, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: T.line,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: T.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{challenge.title}</Text>
          {!!challenge.description && (
            <Text style={{ color: T.textSub, fontSize: 13, marginTop: 3 }} numberOfLines={2}>{challenge.description}</Text>
          )}
        </View>
        <StatusPill status={challenge.status} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="users" size={13} color={T.textFaint} />
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{challenge.participantCount} participants</Text>
        </View>
        {!!challenge.prizeLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Feather name="award" size={13} color={T.brandGold} />
            <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12, flexShrink: 1 }}>{challenge.prizeLabel}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="calendar" size={13} color={T.textFaint} />
          <Text numberOfLines={1} style={{ color: T.textSub, fontSize: 12 }}>{formatDateRange(challenge.startsAt, challenge.endsAt)}</Text>
        </View>
      </View>

      {challenge.status === 'Active' && (
        <Pressable
          onPress={() => handleAction('Cancelled')}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${challenge.title}`}
          accessibilityState={{ disabled: isPending, busy: isPending }}
          hitSlop={8}
          style={{
            alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: withAlpha(T.err, 0.094), borderWidth: 1, borderColor: withAlpha(T.err, 0.25), opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending
            ? <ActivityIndicator size="small" color={T.err} />
            : <Text style={{ color: T.err, fontSize: 12, fontWeight: '700' }}>Cancel</Text>}
        </Pressable>
      )}

      {challenge.status === 'Draft' && (
        <Pressable
          onPress={() => handleAction('Active')}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`Activate ${challenge.title}`}
          accessibilityState={{ disabled: isPending, busy: isPending }}
          hitSlop={8}
          style={{
            alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: T.brandDim, borderWidth: 1, borderColor: T.brandBorder, opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending
            ? <ActivityIndicator size="small" color={T.brand} />
            : <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>Activate</Text>}
        </Pressable>
      )}
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
export default function ChallengesAdminPage({ onBack }: Props) {
  const [showForm, setShowForm] = useState(false);
  const { data: challenges = [], isLoading, isError, refetch } = useChallenges();

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Engagement"
        title="Challenges"
        onBack={onBack}
        action={{ label: showForm ? 'Close' : 'New challenge', icon: showForm ? 'x' : 'plus', onPress: () => setShowForm((v) => !v) }}
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {showForm && <CreateChallengeForm onClose={() => setShowForm(false)} />}

        {isLoading && <LoadingState label="Loading challenges" />}

        {isError && !isLoading && (
          <EmptyState icon="alert-triangle" tone="error" title="Failed to load challenges" action={{ label: 'Retry', onPress: () => refetch() }} />
        )}

        {!isLoading && !isError && challenges.length === 0 && (
          <EmptyState icon="flag" title="No challenges yet" subtitle="Create a challenge to get members engaged." />
        )}

        {!isLoading && !isError && challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
