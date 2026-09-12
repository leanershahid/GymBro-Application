import { Pressable, PressableProps } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface Props extends Omit<PressableProps, 'onPress'> {
  onPress: () => void;
}

export default function BackButton({ onPress, ...rest }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="w-[38px] h-[38px] rounded-full bg-surface border border-line items-center justify-center mr-3"
      {...rest}
    >
      <Feather name="arrow-left" size={18} color="#FFF" />
    </Pressable>
  );
}
