import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, SP } from '../../../theme';
import BackButton from './BackButton';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  title: string;
  /** Small uppercase line above the title, e.g. "Manage". */
  eyebrow?: string;
  onBack?: () => void;
  /** Optional pill action on the right, e.g. { label: 'Add', icon: 'plus', onPress }. */
  action?: { label: string; icon?: FeatherIconName; onPress: () => void };
  /** Anything else to render on the right (instead of `action`). */
  right?: React.ReactNode;
}

/** Standard screen header: back button · eyebrow + title · optional action. */
export default function ScreenHeader({ title, eyebrow, onBack, action, right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SP.xl, paddingTop: SP.lg, paddingBottom: SP.lg }}>
      {onBack && <BackButton onPress={onBack} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <Text
            numberOfLines={1}
            style={{ color: T.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}
          >
            {eyebrow}
          </Text>
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: T.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}
        >
          {title}
        </Text>
      </View>
      {right}
      {!right && action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40,
            paddingHorizontal: 16, borderRadius: 999,
            backgroundColor: pressed ? T.brandDark : T.brand,
          })}
        >
          {action.icon && <Feather name={action.icon} size={16} color={T.onBrand} />}
          <Text style={{ color: T.onBrand, fontSize: 14, fontWeight: '700' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
