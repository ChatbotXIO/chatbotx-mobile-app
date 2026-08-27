import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface DividerProps {
  /** Insets the divider from the leading edge (e.g. to align past a leading icon/avatar in a
   * list). */
  inset?: boolean;
}

/** Hairline horizontal rule using the subtle border token. */
export function Divider({ inset = false }: DividerProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={[
        styles.line,
        { backgroundColor: colors.borderSubtle },
        inset ? { marginStart: spacing.xl + spacing.sm } : undefined,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
