import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/use-theme';

interface ScreenProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  padded?: boolean;
}

/** Base screen wrapper: theme background + safe-area insets. Use for every top-level route. */
export function Screen({ children, style, edges, padded = false }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.container,
        { backgroundColor: colors.bg },
        padded && { padding: spacing.md },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
