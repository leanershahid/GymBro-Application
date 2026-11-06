import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import { apiErrorText } from '../../../api/apiError';
import PrimaryButton from '../../common/components/PrimaryButton';
import { useToast } from '../../common/components/Toast';
import { usePendingClassFeedback, useSubmitClassFeedback } from '../api/supportQueries';
import { Card, StarRating } from './SupportUi';

/**
 * Home card after an attended class: "How was {class}?" with 1–5 stars and an optional comment.
 * Asked once per booking (answer or "Not now"); hidden when the gym turned it off or nothing is due.
 */
export default function ClassFeedbackCard() {
  const toast = useToast();
  const q = usePendingClassFeedback();
  const submit = useSubmitClassFeedback();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [thanked, setThanked] = useState(false);
  const p = q.data;
  if (thanked) {
    return (
      <Card accent={T.brand}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '700' }}>Thanks for the feedback!</Text>
        <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>It helps the coaches make every class better.</Text>
      </Card>
    );
  }
  if (!p) return null;

  const send = (skip: boolean) => submit.mutate(
    { bookingId: p.bookingId, score: skip ? undefined : stars, comment: skip ? undefined : comment.trim() || undefined, skip },
    { onSuccess: () => { if (!skip) setThanked(true); }, onError: e => toast.show({ type: 'error', message: apiErrorText(e) }) },
  );

  return (
    <Card accent={T.brandGold}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SP.md }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: T.text, fontSize: 17, fontWeight: '700' }}>How was {p.className}?</Text>
          <Text style={{ color: T.textSub, fontSize: 13, marginTop: 2 }}>{p.trainerName ? `With ${p.trainerName} · ` : ''}takes two seconds</Text>
        </View>
        <Pressable onPress={() => send(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Not now, skip this class feedback"
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="x" size={18} color={T.textFaint} />
        </Pressable>
      </View>
      <StarRating value={stars} onChange={setStars} label={`Rate ${p.className}`} />
      {stars > 0 && (
        <>
          <TextInput value={comment} onChangeText={setComment} placeholder="What stood out? (optional)" placeholderTextColor={T.textFaint}
            multiline maxLength={1000} accessibilityLabel="Comment (optional)"
            style={{ marginTop: SP.sm, minHeight: 56, color: T.text, fontSize: 14, padding: SP.md, backgroundColor: T.bgInputActive, borderRadius: R.md, borderWidth: 1, borderColor: T.line }} />
          <PrimaryButton label="Send" icon="send" loading={submit.isPending} onPress={() => send(false)} style={{ marginTop: SP.md }} />
        </>
      )}
    </Card>
  );
}
