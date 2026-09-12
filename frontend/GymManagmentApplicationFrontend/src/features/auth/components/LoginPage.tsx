import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  Easing,
  ImageBackground,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLogin } from '../api/authQueries';
import { scaleW, scaleH, rs } from '../../../utils/scale';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Layout split — adjusts slightly on very small screens (< 700 px tall)
const HERO_RATIO  = SCREEN_HEIGHT < 700 ? 0.42 : 0.50;
const SHEET_RATIO = 1 - HERO_RATIO;
const HERO_HEIGHT  = SCREEN_HEIGHT * HERO_RATIO;
const SHEET_HEIGHT = SCREEN_HEIGHT * SHEET_RATIO;

// ─── CTA Button ───────────────────────────────────────────────────────────────
function CTAButton({
  label,
  onPress,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.ctaButton, loading && { backgroundColor: '#5FA317' }]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={loading}
        activeOpacity={1}
      >
        {loading
          ? <ActivityIndicator color="#000000" />
          : <Text style={styles.ctaText}>{label}</Text>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function InputField({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  rightElement,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  rightElement?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#242B24', '#7ED321'],
  });

  return (
    <Animated.View style={[styles.inputWrapper, { borderColor }]}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor="#555555"
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        underlineColorAndroid="transparent"
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LoginPage({
  onLoginSuccess,
  errorMessage,
}: {
  onLoginSuccess: (role: string, userId: number) => void;
  errorMessage?: string;
}) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState(errorMessage ?? '');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const { mutate, isPending } = useLogin();

  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const sheetOpacity    = useRef(new Animated.Value(0)).current;
  const heroOpacity     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setFieldErrors({});
    mutate(
      { email: email.trim(), password },
      {
        onSuccess: (res) => {
          if (res.success) {
            onLoginSuccess(res.data?.role ?? 'client', res.data?.userId ?? 0);
          } else {
            // Route each error string to the right field by keyword matching
            const errs = res.errors ?? [];
            const fe: { email?: string; password?: string } = {};
            const unmatched: string[] = [];

            errs.forEach((msg) => {
              const lower = msg.toLowerCase();
              if (lower.includes('email')) {
                fe.email = msg;
              } else if (lower.includes('password')) {
                fe.password = msg;
              } else {
                unmatched.push(msg);
              }
            });

            setFieldErrors(fe);
            // Any errors that didn't match a specific field go to the general banner
            if (unmatched.length > 0) {
              setError(unmatched.join('\n'));
            } else if (Object.keys(fe).length === 0) {
              setError(res.message ?? 'Login failed. Please try again.');
            }
          }
        },
        onError: () => {
          setError('Could not connect to server. Please try again.');
        },
      }
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Full-screen background image — visible behind hero AND form ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]}>
        <ImageBackground
          source={require('../../../assets/loginImages/image02.jpg')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        >
          {/* Single dark overlay over the whole screen */}
          <View style={[StyleSheet.absoluteFill, styles.heroOverlay]} pointerEvents="none" />
        </ImageBackground>
      </Animated.View>

      {/* Logo — pinned to left side of hero */}
      <Animated.View style={[styles.heroLabel, { opacity: heroOpacity }]} pointerEvents="none">
        <Image
          source={require('../../../assets/common/logo01.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Bottom sheet — no scroll, fits all content in fixed height ── */}
      <KeyboardAvoidingView
        style={styles.sheetContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          {/* Headline */}
          <Text style={styles.headline}>Welcome Our GYM</Text>

          {/* Sign In tab */}
          <View style={styles.tabRow}>
            <View style={styles.tabActive}>
              <Text style={styles.tabTextActive}>Sign In</Text>
              <View style={styles.tabUnderline} />
            </View>
          </View>

          {/* Hairline */}
          <View style={styles.hairline} />

          {/* Error banner */}
          {!!error && (
            <View style={styles.errorBanner}>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Inputs */}
          <View style={styles.inputsStack}>
            <View>
              <InputField
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="Username or email..."
                keyboardType="email-address"
              />
              {!!fieldErrors.email && (
                <Text style={styles.fieldError}>{fieldErrors.email}</Text>
              )}
            </View>
            <View>
              <InputField
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="Password..."
                secureTextEntry={!showPass}
                rightElement={
                  <TouchableOpacity
                    style={styles.showHideBtn}
                    onPress={() => setShowPass((p) => !p)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showHideText}>{showPass ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                }
              />
              {!!fieldErrors.password && (
                <Text style={styles.fieldError}>{fieldErrors.password}</Text>
              )}
            </View>
          </View>

          {/* CTA */}
          <View style={styles.ctaWrapper}>
            <CTAButton label="Sign In" onPress={handleSignIn} loading={isPending} />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F0A',
  },

  heroOverlay: {
    backgroundColor: 'rgba(0,0,0,0.48)',
  },

  // GymManager label — always sits just above the sheet's top edge
  heroLabel: {
    position: 'absolute',
    top: HERO_HEIGHT - scaleH(150),
    left: scaleW(16),
    alignItems: 'flex-start',
  },
  heroLogo: {
    width: SCREEN_WIDTH * 0.90,
    height: scaleH(190),
   
  
  },


  // Sheet anchored to bottom, height = remaining screen after hero
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
  },
  sheet: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.72)',
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    paddingHorizontal: scaleW(20),
    paddingTop: scaleH(24),
    paddingBottom: scaleH(28),
    justifyContent: 'center',
  },

  headline: {
    fontSize: rs(22),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: scaleH(12),
  },

  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scaleH(14),
  },
  tabActive: {
    alignItems: 'center',
    paddingBottom: scaleH(4),
  },
  tabTextActive: {
    fontSize: rs(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabUnderline: {
    marginTop: scaleH(4),
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#7ED321',
  },

  hairline: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginBottom: scaleH(14),
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    borderRadius: rs(12),
    paddingHorizontal: scaleW(12),
    paddingVertical: scaleH(8),
    marginBottom: scaleH(10),
    gap: scaleW(8),
  },
  errorDot: {
    width: rs(6),
    height: rs(6),
    borderRadius: rs(3),
    backgroundColor: '#EF4444',
    marginTop: scaleH(4),
  },
  errorText: {
    flex: 1,
    fontSize: rs(13),
    color: '#F87171',
    lineHeight: rs(18),
  },

  inputsStack: {
    gap: scaleH(10),
  },  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scaleH(50),
    borderRadius: scaleH(50),
    borderWidth: 1,
    borderColor: '#242B24',
    backgroundColor: '#1C211C',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: scaleW(20),
    fontSize: rs(14),
    color: '#FFFFFF',
    height: '100%',
  },
  showHideBtn: {
    paddingHorizontal: scaleW(16),
    paddingVertical: scaleH(10),
  },
  showHideText: {
    fontSize: rs(11),
    fontWeight: '600',
    color: '#7ED321',
  },

  ctaWrapper: {
    marginTop: scaleH(18),
  },
  ctaButton: {
    height: scaleH(52),
    borderRadius: scaleH(52),
    backgroundColor: '#7ED321',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: rs(16),
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.3,
  },

  fieldError: {
    fontSize: rs(12),
    color: '#F87171',
    marginTop: scaleH(4),
    marginLeft: scaleW(16),
  },
});