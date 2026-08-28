import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { IconButton } from '@/components/ui/icon-button';
import { useTheme } from '@/theme/use-theme';

interface ScrollToBottomFabProps {
  newMessageCount: number;
  onPress: () => void;
}

/** Floating action button shown over the message list when the user has scrolled away from the
 * bottom and new messages have arrived — tapping scrolls to the end and (via the parent's own
 * state reset) clears the badge. */
export function ScrollToBottomFab({ newMessageCount, onPress }: ScrollToBottomFabProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown}
      exiting={FadeOutDown}
      style={[styles.wrapper, { bottom: spacing.md, end: spacing.md }]}
    >
      <IconButton
        accessibilityLabel={t('chat.scrollToBottom')}
        icon="arrow-down"
        variant="filled"
        size="lg"
        badgeCount={newMessageCount}
        onPress={onPress}
        haptic="light"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
  },
});
