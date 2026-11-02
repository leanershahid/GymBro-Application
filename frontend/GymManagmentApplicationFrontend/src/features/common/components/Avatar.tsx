import React, { useEffect, useState } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T, withAlpha } from '../../../theme';
import { DEFAULT_AVATAR_URL } from '../../../config';

interface Props {
  /** Photo URL; empty, invalid or failing to load shows the default profile picture. */
  uri?: string | null;
  size?: number;
  /** Corner radius; defaults to a circle. */
  radius?: number;
  /** Optional ring around the picture. */
  borderColor?: string;
  borderWidth?: number;
  /** Screen-reader name, e.g. "Sara Khan photo". Omit for decorative avatars. */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** Real photo URLs only — rejects blanks and placeholder strings such as "string". */
const isPhoto = (uri?: string | null): uri is string =>
  !!uri && /^(https?:|file:|blob:|data:image\/|content:)/i.test(uri.trim());

/**
 * A person's picture, used everywhere a user appears. Shows their photo when they have one,
 * otherwise the same default profile picture for everyone (DEFAULT_AVATAR_URL in config.ts —
 * an image on Cloudinary — or a built-in silhouette), never initials.
 */
export default function Avatar({ uri, size = 48, radius, borderColor, borderWidth = borderColor ? 2 : 0, label, style }: Props) {
  const [failed, setFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);

  const r = radius ?? size / 2;
  const frame: StyleProp<ViewStyle> = [{
    width: size, height: size, borderRadius: r, overflow: 'hidden',
    borderWidth, borderColor, backgroundColor: withAlpha(T.textFaint, 0.18),
    alignItems: 'center', justifyContent: 'center',
  }, style];

  if (isPhoto(uri) && !failed) {
    return (
      <View style={frame}>
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={label}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  // Default profile picture: the shared image on Cloudinary, or the built-in silhouette.
  if (isPhoto(DEFAULT_AVATAR_URL) && !defaultFailed) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: DEFAULT_AVATAR_URL }}
          onError={() => setDefaultFailed(true)}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={label}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  // Head and shoulders, cropped by the frame.
  return (
    <View style={frame} accessible={!!label} accessibilityLabel={label} accessibilityRole={label ? 'image' : undefined}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        <Circle cx="32" cy="25" r="11" fill={withAlpha(T.textSub, 0.75)} />
        <Path d="M10 62c0-12.2 9.8-21 22-21s22 8.8 22 21v2H10z" fill={withAlpha(T.textSub, 0.75)} />
      </Svg>
    </View>
  );
}
