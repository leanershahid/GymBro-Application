import React from 'react';
import { View, Text, Platform, TextStyle } from 'react-native';
import { T, SP, R, withAlpha } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { SocialComment } from '../api/social.types';
import { timeAgo, fullDate } from '../utils/time';
import PostOptionsMenu, { MenuAction } from './PostOptionsMenu';

/** Long unbroken words (links, spam) must wrap instead of pushing the row wider than the sheet. */
export const wrapText: TextStyle = Platform.OS === 'web'
  ? ({ wordBreak: 'break-word', overflowWrap: 'anywhere' } as unknown as TextStyle)
  : {};

interface RowProps {
  comment: SocialComment;
  onEdit?: (c: SocialComment) => void;
  onDelete?: (c: SocialComment) => void;
  /** Compact one-liner used for the preview under a post. */
  compact?: boolean;
  /** Row currently being edited in the composer. */
  highlighted?: boolean;
}

export function CommentRow({ comment: c, onEdit, onDelete, compact, highlighted }: RowProps) {
  if (compact) {
    return (
      <Text numberOfLines={2} style={[{ color: T.text, fontSize: 14, lineHeight: 19 }, wrapText]}>
        <Text style={{ fontWeight: '800' }}>{c.user.name} </Text>{c.text}
      </Text>
    );
  }
  const actions: MenuAction[] = [];
  if (c.canEdit && onEdit) actions.push({ label: 'Edit comment', icon: 'edit-2', onPress: () => onEdit(c) });
  if (c.canDelete && onDelete) {
    actions.push({
      label: 'Delete comment', icon: 'trash-2', destructive: true, onPress: () => onDelete(c),
      confirm: { title: 'Delete comment?', message: 'This comment will be removed for everyone.', confirmLabel: 'Delete' },
    });
  }
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: SP.md, paddingLeft: SP.lg, paddingRight: SP.sm, paddingVertical: SP.sm + 2,
        backgroundColor: highlighted ? withAlpha(T.brand, 0.08) : 'transparent',
        borderLeftWidth: 3, borderLeftColor: highlighted ? T.brand : 'transparent',
      }}
    >
      <Avatar uri={c.user.avatarUrl} size={36} label={`${c.user.name} photo`} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 13, fontWeight: '800', flexShrink: 1 }}>{c.user.name}</Text>
          <Text accessibilityLabel={fullDate(c.createdAt)} style={{ color: T.textFaint, fontSize: 12 }}>
            {timeAgo(c.createdAt)}{c.isEdited ? ' · edited' : ''}
          </Text>
        </View>
        <Text style={[{ color: T.text, fontSize: 14, lineHeight: 20, marginTop: 2 }, wrapText]}>{c.text}</Text>
      </View>
      <View style={{ width: 36, marginTop: -4 }}>
        {actions.length > 0 && <PostOptionsMenu title="Comment" actions={actions} accessibilityLabel="Comment options" size={18} />}
      </View>
    </View>
  );
}

/** Full comments, oldest first. */
export default function CommentList({ comments, onEdit, onDelete, editingId }: {
  comments: SocialComment[]; onEdit?: (c: SocialComment) => void; onDelete?: (c: SocialComment) => void; editingId?: number | null;
}) {
  return <>{comments.map(c => <CommentRow key={c.id} comment={c} onEdit={onEdit} onDelete={onDelete} highlighted={c.id === editingId} />)}</>;
}

/** Placeholder rows shaped like comments while they load. */
export function CommentSkeletonRow() {
  const bar = (w: number | string, h = 10) => ({ width: w as number, height: h, borderRadius: R.sm, backgroundColor: T.bgInputActive });
  return (
    <View style={{ flexDirection: 'row', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.sm + 2 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.bgInputActive }} />
      <View style={{ flex: 1, gap: 8, paddingTop: 4 }}>
        <View style={bar(110)} />
        <View style={bar('90%', 12)} />
      </View>
    </View>
  );
}
