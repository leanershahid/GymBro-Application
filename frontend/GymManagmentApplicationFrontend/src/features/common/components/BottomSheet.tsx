import React from 'react';
import { View, Text, Pressable, Modal, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, R, withAlpha } from '../../../theme';

export interface SheetAction {
  label: string;
  onPress: () => void;
  /** Brand-coloured, bold (e.g. "Done"). */
  primary?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Header action on the left (e.g. Cancel). When omitted the title is left-aligned. */
  leftAction?: SheetAction;
  /** Header action on the right (e.g. Done). Defaults to a "Close" link. */
  rightAction?: SheetAction;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

function HeaderAction({ action }: { action: SheetAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontSize: 15, fontWeight: action.primary ? '700' : '400', color: action.primary ? T.brand : T.textSub }}>
        {action.label}
      </Text>
    </Pressable>
  );
}

/**
 * Bottom modal sheet shared by pickers and dropdowns: dimmed backdrop (tap to close),
 * rounded top, header with optional actions, and padding for the home-indicator inset.
 */
export default function BottomSheet({ visible, onClose, title, leftAction, rightAction, children, style }: Props) {
  const insets = useSafeAreaInsets();
  const right = rightAction ?? { label: 'Close', onPress: onClose };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: withAlpha(T.black, 0.6) }}
      />
      <View
        style={[
          {
            backgroundColor: T.bgInput,
            borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
            paddingBottom: Math.max(insets.bottom, 20),
          },
          style,
        ]}
      >
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 4, minHeight: 56,
            borderBottomWidth: 1, borderBottomColor: T.line,
          }}
        >
          {leftAction && <HeaderAction action={leftAction} />}
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1, textAlign: leftAction ? 'center' : 'left', marginHorizontal: leftAction ? 8 : 0, fontSize: 15, fontWeight: '700', color: T.text }}
          >
            {title}
          </Text>
          <HeaderAction action={right} />
        </View>
        {children}
      </View>
    </Modal>
  );
}
