import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R, withAlpha } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { SOCIAL_LIMITS } from '../api/social.types';

interface Props {
  myAvatar?: string | null;
  /** Comment being edited: the box is filled with its text and the send button saves it. */
  editing?: { id: number; text: string } | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (text: string) => void;
  onCancelEdit?: () => void;
}

/**
 * Compact composer: avatar, a pill that grows with the text, and a round send button inside it.
 * Empty or over-long text can't be sent; the box is only cleared once a comment is sent.
 */
export default function CommentInput({ myAvatar, editing, busy, error, onSubmit, onCancelEdit }: Props) {
  const [text, setText] = useState('');
  const ref = useRef<TextInput>(null);
  const max = SOCIAL_LIMITS.comment;

  useEffect(() => {
    setText(editing?.text ?? '');
    if (editing) setTimeout(() => ref.current?.focus(), 50);
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clean = text.trim();
  const over = clean.length > max;
  const canSend = clean.length > 0 && !over && !busy;
  const send = () => {
    if (!canSend) return;
    onSubmit(clean);
    if (!editing) setText('');
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T.line, backgroundColor: T.bgInput, paddingTop: SP.sm, paddingBottom: SP.xs }}>
      {editing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SP.lg, marginBottom: SP.sm, paddingHorizontal: SP.md, height: 34, borderRadius: R.pill, backgroundColor: withAlpha(T.brand, 0.1) }}>
          <Feather name="edit-2" size={13} color={T.brand} />
          <Text style={{ flex: 1, color: T.brand, fontSize: 12, fontWeight: '700' }}>Editing your comment</Text>
          <Pressable onPress={onCancelEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel editing">
            <Feather name="x" size={16} color={T.brand} />
          </Pressable>
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, marginHorizontal: SP.lg, marginBottom: SP.sm }}>{error}</Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SP.sm, paddingHorizontal: SP.lg }}>
        <View style={{ paddingBottom: 5 }}><Avatar uri={myAvatar} size={34} /></View>
        <View
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 44, borderRadius: 22, paddingLeft: 16, paddingRight: 5, paddingVertical: 4,
            borderWidth: 1, borderColor: over ? T.err : T.line, backgroundColor: T.bg,
          }}
        >
          <TextInput
            ref={ref}
            value={text}
            onChangeText={setText}
            placeholder={editing ? 'Edit your comment…' : 'Add a comment…'}
            placeholderTextColor={T.textFaint}
            accessibilityLabel={editing ? 'Edit your comment' : 'Write a comment'}
            multiline
            style={{ flex: 1, minHeight: 34, maxHeight: 104, color: T.text, fontSize: 14, lineHeight: 19, paddingTop: 8, paddingBottom: 7, paddingRight: 8 }}
          />
          <Pressable
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Save comment' : 'Post comment'}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? T.brand : T.bgInputActive }}
          >
            {busy ? <ActivityIndicator size="small" color={T.onBrand} /> : <Feather name={editing ? 'check' : 'arrow-up'} size={18} color={canSend ? T.onBrand : T.textFaint} />}
          </Pressable>
        </View>
      </View>
      {clean.length > max * 0.8 && (
        <Text style={{ color: over ? T.err : T.textFaint, fontSize: 11, textAlign: 'right', paddingHorizontal: SP.xl, paddingTop: 3 }}>
          {clean.length}/{max}
        </Text>
      )}
    </View>
  );
}
