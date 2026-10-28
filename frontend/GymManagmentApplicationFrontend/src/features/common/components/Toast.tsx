import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, SP, R, withAlpha, Shadow } from '../../../theme';

type ToastType = 'success' | 'error';

interface ToastOptions {
  type?: ToastType;
  message: string;
  durationMs?: number;
}

interface ToastState extends Required<Omit<ToastOptions, 'durationMs'>> {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON: Record<ToastType, React.ComponentProps<typeof Feather>['name']> = {
  success: 'check-circle',
  error: 'alert-circle',
};

/** App-wide toast host: call useToast().show({ type, message }) from anywhere under it. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const show = useCallback((options: ToastOptions) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const id = ++nextId.current;
    setToast({ id, type: options.type ?? 'success', message: options.message });

    translateY.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(hide, options.durationMs ?? 2800);
  }, [translateY, opacity, hide]);

  const c = toast?.type === 'error' ? T.err : T.ok;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            {
              position: 'absolute',
              top: insets.top + SP.sm,
              left: SP.lg,
              right: SP.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: SP.sm,
              backgroundColor: T.bgInput,
              borderRadius: R.lg,
              borderWidth: 1,
              borderColor: withAlpha(c, 0.35),
              paddingVertical: SP.md,
              paddingHorizontal: SP.lg,
              transform: [{ translateY }],
              opacity,
            },
            Shadow.card,
          ]}
        >
          <Feather name={ICON[toast.type]} size={20} color={c} />
          <Text style={{ flex: 1, color: T.text, fontSize: 14, fontWeight: '600' }} numberOfLines={3}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
