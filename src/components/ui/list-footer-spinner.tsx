import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

interface ListFooterSpinnerProps {
  visible: boolean;
  /** Reserved height for the footer slot — kept constant whether or not the spinner is showing,
   * so toggling `visible` never shifts list content (no jump on pagination end). */
  height?: number;
}

const DEFAULT_HEIGHT = 56;

/** FlatList/FlashList `ListFooterComponent` for infinite-scroll pagination. Always reserves
 * `height`, whether or not the spinner is actually visible. */
export function ListFooterSpinner({ visible, height = DEFAULT_HEIGHT }: ListFooterSpinnerProps) {
  const { colors } = useTheme();

  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      {visible ? <ActivityIndicator color={colors.textSecondary} /> : null}
    </View>
  );
}
