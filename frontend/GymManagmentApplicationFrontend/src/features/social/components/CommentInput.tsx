import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { SOCIAL_LIMITS } from '../api/social.types';

interface Props {
  myAvatar?: string | null;
  /** Comment being edited: the box is filled with its text and the button says "Save". */
  editing?: { id: number; text: string } | null;
  busy?: boolean;
  error?: string | null;
  onSubmit: (text: string) => void;
  onCancelEdit?: () => void;
}

/** Add-a-comment box. Empty or over-long text can't be sent; the parent clears nothing until the server accepts it. */
export default function CommentInput({ myAvatar, editing, busy, error, onSubmit, onCancelEdit }: Props) {
  const [text, setText] = useState('');
  const ref = useRef<TextInput>(null);
  const max = SOCIAL_LIMITS.comment;

  useEffect(() => {
    setText(editing?.text ?? '');
    if (editing) setTimeout(() => ref.current?.focus(), 50);
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clean = text.trim();
  const canSend = clean.length > 0 && clean.length <= max && !busy;
  const send = () => {
    if (!canSend) return;
    onSubmit(clean);
    if (!editing) setText('');
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: T.line, paddingTop: SP.sm }}>
      {editing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SP.lg, paddingBottom: 6 }}>
          <Text style={{ color: T.brand, fontSize: 12, fontWeight: '700' }}>Editing comment</Text>
          <Pressable onPress={onCancelEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cancel editing">
            <Feather name="x" size={16} color={T.textSub} />
          </Pressable>
        </View>
      )}
      {!!error && <Text accessibilityRole="alert" style={{ color: T.err, fontSize: 12, paddingHorizontal: SP.lg, paddingBottom: 6 }}>{error}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SP.sm, paddingHorizontal: SP.lg }}>
        <Avatar uri={myAvatar} size={32} />
        <View style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 22, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, paddingHorizontal: 14, justifyContent: 'center' }}>
          <TextInput
            ref={ref}
            value={text}
            onChangeText={setText}
            placeholder="Add a comment…"
            placeholderTextColor={T.textFaint}
            accessibilityLabel="Add a comment"
            multiline
            maxLength={max + 50}
            style={{ color: T.text, fontSize: 14, paddingVertical: 10, maxHeight: 100 }}
          />
        </View>
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Save comment' : 'Post comment'}
          style={{ height: 44, minWidth: 56, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: canSend ? T.brand : T.bgInputActive }}
        >
          {busy ? <ActivityIndicator size="small" color={T.onBrand} /> : (
            <Text style={{ color: canSend ? T.onBrand : T.textFaint, fontSize: 14, fontWeight: '800' }}>{editing ? 'Save' : 'Post'}</Text>
          )}
        </Pressable>
      </View>
      {clean.length > max * 0.85 && (
        <Text style={{ color: clean.length > max ? T.err : T.textFaint, fontSize: 11, textAlign: 'right', paddingHorizontal: SP.lg, paddingTop: 2 }}>
          {clean.length}/{max}
        </Text>
      )}
    </View>
  );
}
