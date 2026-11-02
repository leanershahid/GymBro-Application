import React from 'react';
import { View, Text } from 'react-native';
import { T, SP } from '../../../theme';
import Avatar from '../../common/components/Avatar';
import { SocialComment } from '../api/social.types';
import { timeAgo, fullDate } from '../utils/time';
import PostOptionsMenu, { MenuAction } from './PostOptionsMenu';

interface RowProps {
  comment: SocialComment;
  onEdit?: (c: SocialComment) => void;
  onDelete?: (c: SocialComment) => void;
  /** Compact one-liner used for the preview under a post. */
  compact?: boolean;
}

export function CommentRow({ comment: c, onEdit, onDelete, compact }: RowProps) {
  if (compact) {
    return (
      <Text numberOfLines={2} style={{ color: T.text, fontSize: 14, lineHeight: 19 }}>
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
    <View style={{ flexDirection: 'row', gap: SP.md, paddingHorizontal: SP.lg, paddingVertical: SP.sm }}>
      <Avatar uri={c.user.avatarUrl} size={36} label={`${c.user.name} photo`} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.text, fontSize: 14, lineHeight: 20 }}>
          <Text style={{ fontWeight: '800' }}>{c.user.name}  </Text>{c.text}
        </Text>
        <Text accessibilityLabel={fullDate(c.createdAt)} style={{ color: T.textFaint, fontSize: 12, marginTop: 3 }}>
          {timeAgo(c.createdAt)}{c.isEdited ? ' · edited' : ''}
        </Text>
      </View>
      {actions.length > 0 && <PostOptionsMenu title="Comment" actions={actions} accessibilityLabel="Comment options" size={18} />}
    </View>
  );
}

/** Full comments, oldest first. */
export default function CommentList({ comments, onEdit, onDelete }: { comments: SocialComment[]; onEdit?: (c: SocialComment) => void; onDelete?: (c: SocialComment) => void }) {
  return <>{comments.map(c => <CommentRow key={c.id} comment={c} onEdit={onEdit} onDelete={onDelete} />)}</>;
}
