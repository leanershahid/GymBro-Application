import React from 'react';
import { View, StatusBar, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../../../theme';

interface Props {
  children: React.ReactNode;
  /** Pad the top by the status bar / notch inset (default true). */
  top?: boolean;
  /** Pad the bottom by the home-indicator inset (default false — tab bars and footers handle it). */
  bottom?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Root container for every screen: dark background, light status bar, and real safe-area
 * insets on iOS and Android (notch, Dynamic Island, gesture bar) instead of the old
 * `Platform.OS === 'android' ? StatusBar.currentHeight : 0` guess.
 */
export default function Screen({ children, top = true, bottom = false, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: T.bg, paddingTop: top ? insets.top : 0, paddingBottom: bottom ? insets.bottom : 0 },
        style,
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      {children}
    </View>
  );
}
