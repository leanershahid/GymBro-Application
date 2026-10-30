import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import { T, withAlpha } from '../../../theme';

const LOGO = require('../../../assets/common/logo-mark.png');
const LOGO_RATIO = 438 / 360; // height / width of logo-mark.png
const useNative = Platform.OS !== 'web';

interface Props {
  /** Logo width in px. */
  size?: number;
  label?: string;
}

/**
 * Animated GymBro logo: the mark breathes over a pulsing lime glow, with an
 * indeterminate progress bar underneath. Used for the boot splash.
 */
export default function LogoLoader({ size = 96, label }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.6)), useNativeDriver: useNative }).start();
    const breathe = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: useNative }),
    ]));
    const bar = Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: useNative }));
    breathe.start(); bar.start();
    return () => { breathe.stop(); bar.stop(); };
  }, [intro, pulse, sweep]);

  const logoH = size * LOGO_RATIO;
  const glow = size * 1.7;
  const trackW = size * 1.1;
  const barW = trackW * 0.4;

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'} style={{ alignItems: 'center' }}>
      <View style={{ width: glow, height: glow, alignItems: 'center', justifyContent: 'center' }}>
        {/* Soft glow behind the mark */}
        <Animated.View
          style={{
            position: 'absolute', width: glow, height: glow, borderRadius: glow / 2,
            backgroundColor: withAlpha(T.logoLime, 0.14),
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute', width: glow * 0.72, height: glow * 0.72, borderRadius: glow,
            backgroundColor: withAlpha(T.logoLime, 0.12),
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }),
          }}
        />
        <Animated.Image
          source={LOGO}
          resizeMode="contain"
          style={{
            width: size, height: logoH,
            opacity: intro,
            transform: [
              { scale: Animated.multiply(
                  intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                  pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.04] }),
                ) },
              { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
            ],
          }}
        />
      </View>

      {/* Indeterminate bar */}
      <View style={{ width: trackW, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: withAlpha(T.logoLime, 0.15), marginTop: 4 }}>
        <Animated.View
          style={{
            width: barW, height: 3, borderRadius: 2, backgroundColor: T.logoLime,
            transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-barW, trackW] }) }],
          }}
        />
      </View>

      {!!label && <Text style={{ color: T.textSub, fontSize: 13, marginTop: 14, letterSpacing: 0.3 }}>{label}</Text>}
    </View>
  );
}

interface SplashProps {
  /** True while the app is still getting ready; the splash fades out once it turns false. */
  loading: boolean;
  /** Keep the splash up at least this long so the animation is seen, not flashed. */
  minDurationMs?: number;
}

/**
 * Full-screen boot splash drawn over the app. Fades out when `loading` is false and
 * the minimum time has passed, then unmounts. On web it also removes the static
 * HTML splash from public/index.html, which looks identical, so the hand-over is seamless.
 */
export function BootSplash({ loading, minDurationMs = 1400 }: SplashProps) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.getElementById('boot-splash')?.remove();
    const t = setTimeout(() => setMinElapsed(true), minDurationMs);
    return () => clearTimeout(t);
  }, [minDurationMs]);

  useEffect(() => {
    if (loading || !minElapsed) return;
    Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: useNative })
      .start(() => setGone(true));
  }, [loading, minElapsed, fade]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={loading || !minElapsed ? 'auto' : 'none'}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
        backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center',
        opacity: fade,
      }}
    >
      <LogoLoader size={96} />
    </Animated.View>
  );
}
