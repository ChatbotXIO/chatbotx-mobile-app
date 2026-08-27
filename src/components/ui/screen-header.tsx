import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

interface ScreenHeaderProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Renders `title` with the `display` variant instead of `title` — for top-level tab screens
   * that want a large, prominent heading. */
  large?: boolean;
}

/** Screen-level header row: optional leading slot (back button, avatar), title/subtitle stack,
 * trailing slot (actions), and a `children` slot below for search bars / filter rows. */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  trailing,
  large = false,
  children,
}: ScreenHeaderProps) {
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
      ]}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        {leading}
        <View style={styles.titleBlock}>
          {title ? (
            <Text variant={large ? 'display' : 'heading'} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={[styles.row, { gap: spacing.xs }]}>{trailing}</View> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
});
