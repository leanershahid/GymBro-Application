import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP, R } from '../../../theme';
import BottomSheet from '../../common/components/BottomSheet';
import PrimaryButton from '../../common/components/PrimaryButton';

export interface MenuAction {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  destructive?: boolean;
  /** Ask "are you sure?" first (delete). */
  confirm?: { title: string; message: string; confirmLabel: string };
}

interface Props {
  title: string;
  actions: MenuAction[];
  accessibilityLabel: string;
  size?: number;
}

/**
 * The "···" button of a post or comment. native alerts do not render on web, so the choice list and the
 * delete confirmation are both sheets, which work the same on every platform.
 */
export default function PostOptionsMenu({ title, actions, accessibilityLabel, size = 20 }: Props) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<MenuAction | null>(null);
  if (actions.length === 0) return null;

  const choose = (a: MenuAction) => {
    setOpen(false);
    if (a.confirm) setAsking(a);
    else a.onPress();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Feather name="more-horizontal" size={size} color={T.textSub} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ padding: SP.md, gap: 4 }}>
          {actions.map(a => (
            <Pressable
              key={a.label}
              onPress={() => choose(a)}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: SP.md, minHeight: 52, paddingHorizontal: SP.md, borderRadius: R.md, backgroundColor: pressed ? T.bgInputActive : 'transparent' })}
            >
              <Feather name={a.icon} size={19} color={a.destructive ? T.err : T.text} />
              <Text style={{ color: a.destructive ? T.err : T.text, fontSize: 15, fontWeight: '600' }}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={!!asking} onClose={() => setAsking(null)} title={asking?.confirm?.title ?? ''}>
        <View style={{ padding: SP.xl, gap: SP.lg }}>
          <Text style={{ color: T.textSub, fontSize: 14, lineHeight: 20 }}>{asking?.confirm?.message}</Text>
          <PrimaryButton
            label={asking?.confirm?.confirmLabel ?? 'Confirm'}
            variant="danger"
            onPress={() => { const a = asking; setAsking(null); a?.onPress(); }}
          />
          <PrimaryButton label="Cancel" variant="secondary" onPress={() => setAsking(null)} />
        </View>
      </BottomSheet>
    </>
  );
}
