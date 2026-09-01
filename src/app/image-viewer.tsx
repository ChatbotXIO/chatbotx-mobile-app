import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

/** Root-level route, transparent fullScreenModal presentation (declared on its Stack.Screen in
 * src/app/_layout.tsx). Simple full-screen image + close button — pinch-zoom is skipped, it would
 * need a gesture-handler-driven zoom wrapper that's not worth the complexity for this phase.
 * Background is a near-opaque scrim over black (not `colors.scrim`, which is tuned at 0.5 alpha
 * for overlays atop app content — this route wants the image to read as the sole subject, closer
 * to opaque) so it stays consistent regardless of the active theme scheme. */
export default function ImageViewerScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: withAlpha('#000000', 0.92) }]}>
      <StatusBar style="light" />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + 8 }]}
      >
        <Icon name="x" size={28} color={colors.textInverse} />
      </Pressable>
      {url ? <Image source={{ uri: url }} style={styles.image} contentFit="contain" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    end: 16,
    zIndex: 1,
    padding: 8,
  },
});
