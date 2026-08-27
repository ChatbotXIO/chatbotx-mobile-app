import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { forwardRef, type PropsWithChildren, type ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/use-theme';

import { IconButton } from './icon-button';
import { Text } from './text';

interface SheetProps extends PropsWithChildren {
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

/** Wraps @gorhom/bottom-sheet with our theme colors and a tap-to-dismiss backdrop. Used for
 * filter/saved-replies/assignment sheets — see plan's "not routes" note on these. */
export const Sheet = forwardRef<BottomSheet, SheetProps>(function Sheet(
  { children, snapPoints = ['50%', '90%'], onDismiss },
  ref,
) {
  const { colors, radius } = useTheme();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
    </BottomSheet>
  );
});

interface SheetModalProps extends PropsWithChildren {
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
}

/** Modal variant using `@gorhom/bottom-sheet`'s `BottomSheetModal` — renders in a portal above
 * everything else (including the tab bar), unlike the inline `Sheet` above which is constrained
 * to wherever it's mounted in the tree. Requires a `BottomSheetModalProvider` ancestor (already
 * mounted once at the app root in `src/app/_layout.tsx`). Use this for sheets opened from screens
 * nested under the tab navigator that need to visually overlay the tab bar (field editors,
 * composer action sheets, etc). */
export const SheetModal = forwardRef<BottomSheetModal, SheetModalProps>(function SheetModal(
  { children, snapPoints = ['50%', '90%'], onDismiss },
  ref,
) {
  const { colors, radius } = useTheme();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={{ flex: 1 }}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
});

interface SheetHeaderProps {
  title: string;
  onClose?: () => void;
  trailing?: ReactNode;
}

/** Standard sheet header row: title, optional trailing slot, optional close button. Not required
 * — sheets with fully custom headers can skip it. */
export function SheetHeader({ title, onClose, trailing }: SheetHeaderProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.header,
        { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
      ]}
    >
      <Text variant="title" style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {trailing}
      {onClose ? (
        <IconButton
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          icon="close"
          size="sm"
          variant="tonal"
          onPress={onClose}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
});
