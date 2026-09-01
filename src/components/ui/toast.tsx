import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

type Tone = 'neutral' | 'success' | 'danger' | 'info';

interface ToastOptions {
  message: string;
  tone?: Tone;
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

interface QueuedToast extends ToastOptions {
  id: number;
}

type ShowToast = (opts: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);

const DEFAULT_DURATION_MS = 3000;
const TOAST_HEIGHT = 48;

/** Mount once near the app root. Provides `useToast()` to any descendant; renders a single toast
 * at a time from a simple FIFO queue — a new toast while one is showing waits its turn rather
 * than stacking or replacing. The head of `queue` (index 0) is always the currently-displayed
 * toast, so there's no separate "current" state to keep in sync — dismissing just shifts the
 * array, which is itself the transition to whatever's next. */
export function ToastProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const { colors, radius, spacing, motion } = useTheme();
  const reducedMotion = useReducedMotion();

  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);
  const translateY = useSharedValue(TOAST_HEIGHT + 40);
  const opacity = useSharedValue(0);

  const current = queue[0] ?? null;

  const show = useCallback<ShowToast>((opts) => {
    nextId.current += 1;
    setQueue((prev) => [...prev, { ...opts, id: nextId.current }]);
  }, []);

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Animate the current toast in, then out after its duration, then dismiss it so the next
  // queued toast (if any) becomes `current` on the following render.
  useEffect(() => {
    if (!current) return undefined;

    if (reducedMotion) {
      translateY.value = 0;
      opacity.value = 1;
    } else {
      translateY.value = withTiming(0, { duration: motion.durations.enter });
      opacity.value = withTiming(1, { duration: motion.durations.enter });
    }

    const duration = current.durationMs ?? DEFAULT_DURATION_MS;
    // Both timers are tracked (not just the outer one) so cleanup can cancel the exit-animation
    // dismiss too — previously only the outer timer was cleared, so if `current` changed (or this
    // unmounted) mid-exit-animation, the inner `setTimeout` still fired later and called
    // `dismissCurrent` against a stale render.
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      if (reducedMotion) {
        translateY.value = TOAST_HEIGHT + 40;
        opacity.value = 0;
        dismissCurrent();
      } else {
        opacity.value = withTiming(0, { duration: motion.durations.exit });
        translateY.value = withTiming(TOAST_HEIGHT + 40, { duration: motion.durations.exit });
        exitTimer = setTimeout(dismissCurrent, motion.durations.exit);
      }
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(exitTimer);
    };
  }, [
    current,
    dismissCurrent,
    reducedMotion,
    motion.durations.enter,
    motion.durations.exit,
    translateY,
    opacity,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const toneColor: Record<Tone, string> = {
    neutral: colors.textInverse,
    success: colors.success,
    danger: colors.danger,
    info: colors.info,
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.host,
            { bottom: insets.bottom + spacing.md },
            reducedMotion ? undefined : animatedStyle,
          ]}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.toast,
              {
                backgroundColor: colors.textPrimary,
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                gap: spacing.sm,
              },
            ]}
          >
            {current.tone && current.tone !== 'neutral' ? (
              <Icon
                name={
                  current.tone === 'success'
                    ? 'circle-check'
                    : current.tone === 'danger'
                      ? 'circle-alert'
                      : 'info'
                }
                size={18}
                color={toneColor[current.tone]}
              />
            ) : null}
            <Text variant="callout" color="inverse" style={styles.message} numberOfLines={2}>
              {current.message}
            </Text>
            {current.action ? (
              <Text
                variant="callout"
                color="inverse"
                style={styles.action}
                onPress={() => {
                  current.action?.onPress();
                  dismissCurrent();
                }}
              >
                {current.action.label}
              </Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

/** Returns a function to enqueue a toast. Must be called under a `ToastProvider`. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return show;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    start: 16,
    end: 16,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  message: {
    flex: 1,
  },
  action: {
    fontWeight: '700',
  },
});
