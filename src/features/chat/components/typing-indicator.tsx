import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { Text } from '@/components/ui/text';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

const DOT_COUNT = 3;
const BOUNCE_HEIGHT = -4;
const CYCLE_MS = 900;

function Dot({ delayMs }: { delayMs: number }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return undefined;

    translateY.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(BOUNCE_HEIGHT, { duration: CYCLE_MS / 3, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: CYCLE_MS / 3, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: CYCLE_MS / 3 }),
        ),
        -1,
      ),
    );

    return () => {
      translateY.value = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value ref is stable.
  }, [reducedMotion, delayMs]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: colors.textSecondary },
        reducedMotion ? undefined : style,
      ]}
    />
  );
}

interface TypingIndicatorProps {
  conversationId: string;
}

/** Reads `typingByConversation` from the chat store — set by the realtime `typing` event handler
 * (Phase 6). Renders nothing when not typing; a `t('chat.typing')`-labeled row with 3 staggered
 * bouncing dots otherwise. */
export function TypingIndicator({ conversationId }: TypingIndicatorProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const isTyping = useChatStore((state) => state.typingByConversation[conversationId] ?? false);

  if (!isTyping) return null;

  return (
    <View
      style={[styles.container, { paddingHorizontal: spacing.md, gap: spacing.xs }]}
      accessibilityLabel={t('chat.typing')}
      accessible
    >
      <View style={[styles.dotsRow, { gap: spacing.xxs + 1 }]}>
        {Array.from({ length: DOT_COUNT }).map((_, index) => (
          <Dot key={index} delayMs={index * (CYCLE_MS / DOT_COUNT)} />
        ))}
      </View>
      <Text variant="caption" color="secondary">
        {t('chat.typing')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
