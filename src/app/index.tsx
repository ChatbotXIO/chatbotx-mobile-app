import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkspaceStore } from '@/stores/use-workspace-store';
import { useReducedMotion } from '@/theme/motion';
import { useTheme } from '@/theme/use-theme';

const LOGO_SIZE = 72;
const PULSE_DURATION_MS = 900;

/**
 * Root redirect gate: !authed → sign-in; mustChangePassword → change-password; no workspace →
 * workspace-picker; else → tabs shell.
 */
export default function IndexRedirect() {
  const status = useAuthStore((state) => state.status);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword ?? false);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);

  if (status === 'pending') {
    return <LoadingScreen />;
  }

  if (status === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (mustChangePassword) {
    return <Redirect href="/(auth)/change-password" />;
  }

  if (!currentWorkspaceId) {
    return <Redirect href="/(app)/workspace-picker" />;
  }

  return <Redirect href="/(app)/(tabs)/conversations" />;
}

/** Brand mark with a gentle pulse instead of a bare spinner — this screen normally shows only for
 * the brief window between the splash screen hiding and the auth/workspace bootstrap gates
 * resolving, so it's the first thing a returning user sees post-splash. */
function LoadingScreen() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1;
      return undefined;
    }
    scale.value = withRepeat(
      withTiming(1.08, { duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return undefined;
  }, [reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Screen>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoCircle,
            { backgroundColor: colors.brandSoft, borderRadius: LOGO_SIZE / 2 },
            animatedStyle,
          ]}
        >
          <Icon name="chatbubbles" size={32} color={colors.brand} />
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
