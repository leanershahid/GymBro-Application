import { Pressable, PressableProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { T, withAlpha } from '../../../theme';

interface Props extends Omit<PressableProps, 'onPress'> {
  onPress: () => void;
  /** 'overlay' = translucent dark circle for use on top of hero images. */
  variant?: 'default' | 'overlay';
  label?: string;
}

export default function BackButton({ onPress, variant = 'default', label = 'Go back', ...rest }: Props) {
  const overlay = variant === 'overlay';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 40, height: 40, borderRadius: 20, marginRight: 12,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1,
        backgroundColor: overlay ? T.overlay : T.bgInput,
        borderColor: overlay ? withAlpha(T.text, 0.12) : T.line,
      }}
      {...rest}
    >
      <Feather name="arrow-left" size={18} color={T.text} />
    </Pressable>
  );
}
