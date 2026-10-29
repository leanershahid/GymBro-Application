import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Animated,
  Easing,
  ImageBackground,
  Image,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLogin, useForgotPassword, useResetPassword } from '../api/authQueries';
import { scaleW, scaleH, rs } from '../../../utils/scale';
import { T, withAlpha, Shadow } from '../../../theme';

/** Scaled font size that never drops below the 11px legibility floor. */
const fs = (px: number) => Math.max(11, rs(px));

/**
 * How many pixels of the screen the software keyboard covers. Measured from the keyboard's
 * top edge against our own root view, so it is right on both iOS and Android, whether or not
 * Android resized the window (edge-to-edge apps don't get resized — that's why the old
 * KeyboardAvoidingView left the fields hidden behind the keyboard on Android).
 */
function useKeyboardOverlap(rootHeight: number) {
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setKeyboardTop(e.endCoordinates.screenY);
    const onHide = () => setKeyboardTop(null);
    const a = Keyboard.addListener(showEvt, onShow);
    const b = Keyboard.addListener(hideEvt, onHide);
    return () => { a.remove(); b.remove(); };
  }, []);

  const visible = keyboardTop !== null;
  const overlap = visible && rootHeight > 0 ? Math.max(0, rootHeight - keyboardTop) : 0;
  return { visible, overlap };
}

/** Layout split from the live window size — adjusts on very small screens (< 700 px tall). */
function useLoginLayout() {
  const { width, height } = useWindowDimensions();
  const heroRatio  = height < 700 ? 0.42 : 0.50;
  const heroHeight  = height * heroRatio;
  const sheetHeight = height - heroHeight;
  // The logo sits just above the sheet; cap it by the hero height so it never runs off the top.
  const logoHeight = Math.min(scaleH(190), heroHeight * 0.7);
  const logoWidth  = Math.min(width * 0.90, logoHeight * 2.4);
  return { width, height, heroHeight, sheetHeight, logoHeight, logoWidth };
}

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
        style={[styles.ctaButton, loading && { backgroundColor: T.brandDark }]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={loading}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {loading
          ? <ActivityIndicator color={T.onBrand} />
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
  accessibilityLabel,
  textContentType,
  autoComplete,
  inputRef,
  returnKeyType,
  onSubmitEditing,
}: {
  accessibilityLabel: string;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: 'next' | 'go';
  onSubmitEditing?: () => void;
  textContentType?: 'username' | 'password' | 'oneTimeCode' | 'newPassword';
  autoComplete?: 'email' | 'password' | 'one-time-code' | 'new-password';
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
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
    outputRange: [T.line, T.brand],
  });

  return (
    <Animated.View style={[styles.inputWrapper, { borderColor }]}>
      <TextInput
        ref={inputRef}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={returnKeyType !== 'next'}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor={T.textFaint}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        underlineColorAndroid="transparent"
        accessibilityLabel={accessibilityLabel}
        textContentType={textContentType}
        autoComplete={autoComplete}
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
/** Inline form error: left accent bar + icon, shakes and fades in on each new message. */
function ErrorBanner({ message }: { message: string }) {
  const shake = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    shake.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
    ]).start();
  }, [message]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <Animated.View
      style={[styles.errorBanner, Shadow.sm, { opacity: fade, transform: [{ translateX }] }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.errorAccent} />
      <View style={styles.errorIconWrap}>
        <Ionicons name="alert-circle" size={rs(18)} color={T.err} />
      </View>
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Forgot / reset password ──────────────────────────────────────────────────
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function ResetPasswordForm({ mode, initialEmail, onCodeSent, onDone, onCancel, onError }: {
  mode: 'forgot' | 'reset';
  initialEmail: string;
  onCodeSent: (email: string) => void;
  onDone: () => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  const sendCode = () => {
    if (!isEmail(email)) return onError('Enter the email address you sign in with.');
    forgot.mutate(email.trim(), {
      onSuccess: (res) => (res.success ? onCodeSent(email.trim()) : onError(res.message)),
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  };

  const submit = () => {
    if (!/^\d{6}$/.test(code.trim())) return onError('Enter the 6-digit code from the email.');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return onError('New password: at least 8 characters, with a letter and a number.');
    if (password !== confirm) return onError('The two passwords do not match.');
    reset.mutate({ email: email.trim(), code: code.trim(), newPassword: password }, {
      onSuccess: (res) => (res.success ? onDone() : onError([res.message, ...(res.errors ?? [])].filter(Boolean).join('\n'))),
      onError: () => onError('Could not connect to server. Please try again.'),
    });
  };

  const toggle = (
    <TouchableOpacity style={styles.showHideBtn} onPress={() => setShow(p => !p)} hitSlop={8}
      accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}>
      <Text style={styles.showHideText}>{show ? 'Hide' : 'Show'}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.inputsStack}>
        {mode === 'forgot' ? (
          <InputField value={email} onChangeText={setEmail} placeholder="Your email..." keyboardType="email-address"
            accessibilityLabel="Email" textContentType="username" autoComplete="email" returnKeyType="go" onSubmitEditing={sendCode} />
        ) : (
          <>
            <InputField value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code..."
              keyboardType="number-pad" accessibilityLabel="Code from email" textContentType="oneTimeCode" autoComplete="one-time-code" returnKeyType="next" />
            <InputField value={password} onChangeText={setPassword} placeholder="New password..." secureTextEntry={!show}
              accessibilityLabel="New password" textContentType="newPassword" autoComplete="new-password" returnKeyType="next" rightElement={toggle} />
            <InputField value={confirm} onChangeText={setConfirm} placeholder="Confirm new password..." secureTextEntry={!show}
              accessibilityLabel="Confirm new password" textContentType="newPassword" autoComplete="new-password" returnKeyType="go" onSubmitEditing={submit} />
          </>
        )}
      </View>

      <View style={styles.ctaWrapper}>
        {mode === 'forgot'
          ? <CTAButton label="Send code" onPress={sendCode} loading={forgot.isPending} />
          : <CTAButton label="Set new password" onPress={submit} loading={reset.isPending} />}
      </View>

      <View style={styles.linkRow}>
        {mode === 'reset' && (
          <TouchableOpacity onPress={sendCode} hitSlop={8} accessibilityRole="button" disabled={forgot.isPending}>
            <Text style={styles.linkText}>Resend code</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },

  heroOverlay: {
    backgroundColor: withAlpha(T.black, 0.48),
  },

  // GymManager label — always sits just above the sheet's top edge
  heroLabel: {
    position: 'absolute',
    left: scaleW(16),
    alignItems: 'flex-start',
  },

  // Fills the screen; the sheet is pushed to the bottom and shrinks when the keyboard opens.
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexShrink: 1,
    backgroundColor: withAlpha(T.bgInput, 0.72),
    borderTopLeftRadius: rs(28),
    borderTopRightRadius: rs(28),
    overflow: 'hidden',
  },
  sheetContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: scaleW(20),
    paddingTop: scaleH(24),
  },

  headline: {
    fontSize: fs(22),
    fontWeight: '800',
    color: T.text,
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
    fontSize: fs(15),
    fontWeight: '700',
    color: T.text,
  },
  tabUnderline: {
    marginTop: scaleH(4),
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: T.brand,
  },

  hairline: {
    height: 1,
    backgroundColor: T.line,
    marginBottom: scaleH(14),
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withAlpha(T.err, 0.12),
    borderRadius: rs(12),
    paddingHorizontal: scaleW(12),
    paddingVertical: scaleH(10),
    marginBottom: scaleH(10),
    gap: scaleW(8),
    overflow: 'hidden',
  },
  errorAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: rs(4),
    backgroundColor: T.err,
  },
  errorIconWrap: {
    marginLeft: scaleW(4),
  },
  errorText: {
    flex: 1,
    fontSize: fs(13),
    fontWeight: '600',
    color: T.text,
    lineHeight: rs(18),
  },

  inputsStack: {
    gap: scaleH(10),
  },  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Math.max(48, scaleH(50)),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.bgInputActive,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: scaleW(20),
    fontSize: fs(14),
    color: T.text,
    height: '100%',
  },
  showHideBtn: {
    paddingHorizontal: scaleW(16),
    minHeight: 44,
    justifyContent: 'center',
  },
  showHideText: {
    fontSize: fs(12),
    fontWeight: '600',
    color: T.brand,
  },

  ctaWrapper: {
    marginTop: scaleH(18),
  },
  ctaButton: {
    height: Math.max(48, scaleH(52)),
    borderRadius: 999,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: fs(16),
    fontWeight: '700',
    color: T.onBrand,
    letterSpacing: 0.3,
  },

  linkBtn: {
    alignSelf: 'flex-end',
    marginTop: scaleH(10),
    marginRight: scaleW(8),
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scaleH(14),
    paddingHorizontal: scaleW(8),
  },
  linkText: {
    fontSize: fs(13),
    fontWeight: '600',
    color: T.brand,
  },
  notice: {
    fontSize: fs(13),
    color: T.text,
    backgroundColor: withAlpha(T.brand, 0.12),
    borderRadius: 12,
    padding: scaleH(10),
    marginBottom: scaleH(10),
  },
  fieldError: {
    fontSize: fs(12),
    color: T.err,
    marginTop: scaleH(4),
    marginLeft: scaleW(16),
  },
});