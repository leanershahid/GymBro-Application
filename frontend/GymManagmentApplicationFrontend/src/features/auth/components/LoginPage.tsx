import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  Easing,
  ImageBackground,
  Image,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogin } from '../api/authQueries';
import { scaleH } from '../../../utils/scale';
import { T } from '../../../theme';
import { styles } from './login/loginStyles';
import { useKeyboardOverlap, useLoginLayout } from './login/useLoginLayout';
import { CTAButton, InputField, ErrorBanner } from './login/LoginControls';
import ResetPasswordForm, { isEmail } from './login/ResetPasswordForm';

// ARCH-115: the inputs, CTA, error banner, reset-password flow, layout hooks and styles live in ./login/.

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
  // 'forgot' = ask for the email, 'reset' = enter the emailed code + new password.
  const [mode, setMode] = useState<'signin' | 'forgot' | 'reset'>('signin');
  const [notice, setNotice] = useState('');

  const { mutate, isPending } = useLogin();
  const insets = useSafeAreaInsets();
  const { heroHeight, sheetHeight, logoHeight, logoWidth } = useLoginLayout();

  // Keyboard handling: lift the sheet above the keyboard, let it grow into the hero area if it
  // needs the room, and scroll the inputs + Sign In button into view.
  const [rootHeight, setRootHeight] = useState(0);
  // `visible` drives the "typing" layout; `overlap` is how far to lift the sheet (0 when
  // Android already resized the window for us).
  const { visible: keyboardOpen, overlap: keyboardOverlap } = useKeyboardOverlap(rootHeight);
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const availableForSheet = rootHeight - keyboardOverlap - insets.top - 8;
  const currentSheetHeight = keyboardOpen
    ? Math.max(Math.min(sheetHeight, availableForSheet), Math.min(availableForSheet, 280))
    : sheetHeight;

  useEffect(() => {
    if (keyboardOpen) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [keyboardOpen, keyboardOverlap]);

  const sheetTranslateY = useRef(new Animated.Value(sheetHeight)).current;
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
        onSettled: () => setNotice(''),
      }
    );
  };

  return (
    <View style={styles.root} onLayout={(e) => setRootHeight(e.nativeEvent.layout.height)}>
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

      {/* Logo — pinned to left side of hero, just above the sheet (never above the status bar) */}
      <Animated.View
        style={[
          styles.heroLabel,
          { opacity: keyboardOpen ? 0 : heroOpacity, top: Math.max(insets.top + 8, heroHeight - logoHeight * (150 / 190)) },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('../../../assets/common/logo01.png')}
          style={{ width: logoWidth, height: logoHeight }}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="GymBro"
        />
      </Animated.View>

      {/* ── Bottom sheet — sits above the keyboard and scrolls when content doesn't fit ── */}
      <View style={[styles.sheetContainer, { paddingBottom: keyboardOverlap }]}>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: currentSheetHeight,
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.sheetContent,
              // The home-indicator inset only matters when the keyboard isn't covering it.
              { paddingBottom: scaleH(28) + (keyboardOpen ? 0 : insets.bottom) },
            ]}
          >
          {/* Headline */}
          <Text style={styles.headline} accessibilityRole="header">Welcome to the gym</Text>

          {/* Sign In tab */}
          <View style={styles.tabRow}>
            <View style={styles.tabActive}>
              <Text style={styles.tabTextActive}>{mode === 'signin' ? 'Sign In' : 'Reset password'}</Text>
              <View style={styles.tabUnderline} />
            </View>
          </View>

          {/* Hairline */}
          <View style={styles.hairline} />

          {/* Error banner */}
          {!!error && <ErrorBanner message={error} />}
          {!!notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text>}

          {mode !== 'signin' ? (
            <ResetPasswordForm
              mode={mode}
              initialEmail={email}
              onCodeSent={(addr) => {
                setEmail(addr); setError(''); setMode('reset');
                setNotice(`If ${addr} has an account, we've emailed a 6-digit code. It expires in 15 minutes.`);
              }}
              onDone={() => { setMode('signin'); setPassword(''); setError(''); setNotice('Password changed. Sign in with your new password.'); }}
              onCancel={() => { setMode('signin'); setError(''); setNotice(''); }}
              onError={(m) => { setNotice(''); setError(m); }}
            />
          ) : (<>
          {/* Inputs */}
          <View style={styles.inputsStack}>
            <View>
              <InputField
                value={email}
                onChangeText={(v) => { setEmail(v); setError(''); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="Username or email..."
                keyboardType="email-address"
                accessibilityLabel="Email"
                textContentType="username"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {!!fieldErrors.email && (
                <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.email}</Text>
              )}
            </View>
            <View>
              <InputField
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="Password..."
                secureTextEntry={!showPass}
                accessibilityLabel="Password"
                textContentType="password"
                autoComplete="password"
                inputRef={passwordRef}
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
                rightElement={
                  <TouchableOpacity
                    style={styles.showHideBtn}
                    onPress={() => setShowPass((p) => !p)}
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPass ? 'Hide password' : 'Show password'}
                  >
                    <Text style={styles.showHideText}>{showPass ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                }
              />
              {!!fieldErrors.password && (
                <Text style={styles.fieldError} accessibilityLiveRegion="polite">{fieldErrors.password}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => { setMode('forgot'); setError(''); setNotice(''); }}
            style={styles.linkBtn}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* CTA */}
          <View style={styles.ctaWrapper}>
            <CTAButton label="Sign In" onPress={handleSignIn} loading={isPending} />
          </View>
          </>)}
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}
