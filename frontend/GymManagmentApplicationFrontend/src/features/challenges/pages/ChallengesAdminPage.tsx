import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput,
  StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T } from '../../trainers/components/theme';
import BackButton from '../../common/components/BackButton';
import EmptyState from '../../dashboard/components/EmptyState';
import { useChallenges, useCreateChallenge, useUpdateChallengeStatus } from '../api/challengeQueries';
import { ChallengeAdminResponse, ChallengeStatus, CreateChallengePayload } from '../types/challenge.types';

const TENANT_ID = 1; // hardcoded until tenant context is available

interface Props { onBack?: () => void; }

const STATUS_COLOR: Record<ChallengeStatus, string> = {
  Active: T.brand,
  Draft: T.textSub,
  Completed: T.sky,
  Cancelled: T.err,
};

function StatusPill({ status }: { status: ChallengeStatus }) {
  const color = STATUS_COLOR[status] ?? T.textSub;
  return (
    <View style={{
      backgroundColor: color + '22', borderWidth: 1, borderColor: color + '55',
      borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
    }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{status}</Text>
    </View>
  );
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
      tenantId: TENANT_ID,
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

      <FormField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. 30-Day Step Challenge" />
      <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Optional description" multiline />
      <FormField label="Target value" value={targetValue} onChangeText={setTargetValue} placeholder="Optional numeric target" keyboardType="numeric" />
      <FormField label="Start date" value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD" />
      <FormField label="End date" value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD" />
      <FormField label="Prize label" value={prizeLabel} onChangeText={setPrizeLabel} placeholder="Optional, e.g. Free month membership" />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel new challenge"
          style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', backgroundColor: T.bg, borderWidth: 1, borderColor: T.line }}
        >
          <Text style={{ color: T.textSub, fontSize: 14, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Create challenge"
          style={{ flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', backgroundColor: T.brand, opacity: isPending ? 0.6 : 1 }}
        >
          {isPending
            ? <ActivityIndicator size="small" color={T.onBrand} />
            : <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '800' }}>Create</Text>}
        </Pressable>
      </View>
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, multiline, keyboardType,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  multiline?: boolean; keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: T.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{
          color: T.text, fontSize: 14, backgroundColor: T.bg, borderRadius: 12,
          borderWidth: 1, borderColor: T.line, paddingHorizontal: 12, paddingVertical: multiline ? 10 : 10,
          minHeight: multiline ? 70 : undefined, textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholder={placeholder}
        placeholderTextColor={T.textFaint}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
      />
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
          <Text style={{ color: T.textSub, fontSize: 12 }}>{challenge.participantCount} participants</Text>
        </View>
        {!!challenge.prizeLabel && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Feather name="award" size={13} color={T.brandGold} />
            <Text style={{ color: T.textSub, fontSize: 12 }}>{challenge.prizeLabel}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="calendar" size={13} color={T.textFaint} />
          <Text style={{ color: T.textSub, fontSize: 12 }}>{formatDateRange(challenge.startsAt, challenge.endsAt)}</Text>
        </View>
      </View>

      {challenge.status === 'Active' && (
        <Pressable
          onPress={() => handleAction('Cancelled')}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${challenge.title}`}
          style={{
            alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: T.err + '18', borderWidth: 1, borderColor: T.err + '40', opacity: isPending ? 0.6 : 1,
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
    <View style={{ flex: 1, backgroundColor: T.bg, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0 }}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack && <BackButton onPress={onBack} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
              Engagement
            </Text>
            <Text style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>Challenges</Text>
          </View>
          <Pressable
            onPress={() => setShowForm((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showForm ? 'Close new challenge form' : 'New challenge'}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
            }}
          >
            <Feather name={showForm ? 'x' : 'plus'} size={15} color={T.onBrand} />
            <Text style={{ color: T.onBrand, fontSize: 13, fontWeight: '700' }}>{showForm ? 'Close' : 'New challenge'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {showForm && <CreateChallengeForm onClose={() => setShowForm(false)} />}

        {isLoading && <ActivityIndicator size="large" color={T.brand} style={{ marginTop: 40 }} />}

        {isError && !isLoading && (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Text style={{ color: T.text, fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Failed to load challenges</Text>
            <Pressable onPress={() => refetch()} style={{ backgroundColor: T.brand, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && challenges.length === 0 && (
          <EmptyState icon="flag" title="No challenges yet" subtitle="Create a challenge to get members engaged." />
        )}

        {!isLoading && !isError && challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </ScrollView>
    </View>
  );
}
