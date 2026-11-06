import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import { showAlert } from '../../common/components/dialogs';
import { apiErrorText } from '../../../api/apiError';
import { useKeepMyAccount, useMyDeletion } from '../api/privacyQueries';
import { fmtDate } from './PrivacyUi';

/**
 * App-wide strip shown while the member's account is scheduled for deletion (mounted once in the
 * member area). "Keep my account" cancels it in one tap; "Details" opens Privacy & data.
 */
export default function PendingDeletionBanner({ onOpenPrivacy }: { onOpenPrivacy?: () => void }) {
  const q = useMyDeletion();
  const keep = useKeepMyAccount();
  const r = q.data;
  if (!r || (r.status !== 'pending' && r.status !== 'blocked')) return null;
  const color = r.status === 'blocked' ? T.brandGold : T.err;

  return (
    <View accessibilityRole="alert"
      style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SP.sm, paddingHorizontal: SP.lg, paddingVertical: SP.sm,
        backgroundColor: withAlpha(color, 0.12), borderBottomWidth: 1, borderBottomColor: withAlpha(color, 0.3) }}>
      <Feather name="alert-triangle" size={16} color={color} />
      <Pressable onPress={onOpenPrivacy} disabled={!onOpenPrivacy} accessibilityRole={onOpenPrivacy ? 'link' : undefined}
        style={{ flex: 1, minWidth: 180, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: T.text, fontSize: 13, fontWeight: '600' }}>
          {r.status === 'blocked'
            ? 'Your account deletion is on hold — see Privacy & data.'
            : `Your account will be deleted on ${fmtDate(r.scheduledFor)}.`}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => keep.mutate(undefined, {
          onSuccess: () => showAlert('Your account is safe', 'We won’t delete it.'),
          onError: e => showAlert('Couldn’t keep your account', apiErrorText(e)),
        })}
        disabled={keep.isPending}
        accessibilityRole="button"
        accessibilityLabel="Keep my account"
        accessibilityState={{ busy: keep.isPending }}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: SP.lg, justifyContent: 'center', borderRadius: R.pill,
          backgroundColor: pressed ? T.brandDark : T.brand })}>
        <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '700' }}>{keep.isPending ? 'Keeping…' : 'Keep my account'}</Text>
      </Pressable>
    </View>
  );
}
