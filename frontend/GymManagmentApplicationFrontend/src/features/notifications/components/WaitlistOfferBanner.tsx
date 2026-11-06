import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { R, SP, T, TY, withAlpha } from '../../../theme';
import PrimaryButton from '../../common/components/PrimaryButton';
import { notify } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useWaitlistOfferAction } from '../api/notificationsQueries';

interface Props {
  userId: number;
  classId: number;
  classTitle: string;
  /** ClassResponse.myOfferExpiresAt (UTC ISO). */
  expiresAt: string;
  /** Refresh the booking lists after claiming / declining. */
  onDone?: () => void;
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function minutesLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

/** "A spot opened — claim by 6:30pm": claim / decline a held waitlist spot (gym "offer" mode). */
export default function WaitlistOfferBanner({ userId, classId, classTitle, expiresAt, onDone }: Props) {
  const [left, setLeft] = useState(() => minutesLeft(expiresAt));
  const action = useWaitlistOfferAction(userId, onDone);

  useEffect(() => {
    const t = setInterval(() => setLeft(minutesLeft(expiresAt)), 15_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (left <= 0) return null;

  const run = (kind: 'claim' | 'decline') =>
    action.mutate({ classId, action: kind }, {
      onSuccess: message => void notify(kind === 'claim' ? "You're in!" : 'Spot released', message),
      onError: e => void notify('Couldn’t update your spot', apiErrorText(e)),
    });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        padding: SP.lg, borderRadius: R.xl, marginBottom: SP.md,
        backgroundColor: withAlpha(T.brand, 0.1), borderWidth: 1, borderColor: withAlpha(T.brand, 0.3),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SP.sm }}>
        <Feather name="zap" size={18} color={T.brand} style={{ marginRight: SP.sm }} />
        <Text accessibilityRole="header" style={{ ...TY.base, color: T.text, fontWeight: '700', flex: 1 }}>
          A spot opened in {classTitle}
        </Text>
      </View>
      <Text style={{ ...TY.sm, color: T.textSub, marginBottom: SP.md }}>
        It's held for you until {timeLabel(expiresAt)} ({left} min left). After that it goes to the next person.
      </Text>
      <PrimaryButton
        label="Claim my spot"
        icon="check"
        onPress={() => run('claim')}
        loading={action.isPending && action.variables?.action === 'claim'}
        disabled={action.isPending}
        accessibilityHint={`Books you into ${classTitle}`}
      />
      <Pressable
        onPress={() => run('decline')}
        disabled={action.isPending}
        accessibilityRole="button"
        accessibilityLabel="I can't make it"
        accessibilityHint="Gives the spot to the next person on the waitlist and removes you from it"
        style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: SP.xs, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ ...TY.base, color: T.textSub, fontWeight: '600' }}>I can't make it</Text>
      </Pressable>
    </View>
  );
}
