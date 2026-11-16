import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/use-theme';

interface PushPermissionSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  /** Tapped "Turn on notifications" — the caller triggers the OS permission dialog. */
  onEnable: () => void;
  /** User declined for now, by button or by swiping the sheet away. */
  onLater: () => void;
}

/**
 * In-app "soft ask" shown before the one-shot OS notification dialog (iOS never re-shows it once
 * denied). Declining here costs nothing, so the OS prompt is only spent on people who said yes.
 */
export function PushPermissionSheet({ sheetRef, onEnable, onLater }: PushPermissionSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  // `onDismiss` fires for every close, including the one we trigger after "Turn on" — this flag
  // keeps that path from being miscounted as a "later".
  const enabledRef = useRef(false);

  function handleEnable() {
    enabledRef.current = true;
    sheetRef.current?.dismiss();
    onEnable();
  }

  function handleDismissed() {
    const wasEnabled = enabledRef.current;
    enabledRef.current = false;
    if (!wasEnabled) onLater();
  }

  return (
    <SheetModal ref={sheetRef} snapPoints={['44%']} onDismiss={handleDismissed}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
          gap: spacing.md,
          alignItems: 'center',
        }}
      >
        <Icon name="bell" size={40} color={colors.brand} />
        <Text variant="title" style={{ textAlign: 'center' }}>
          {t('notifications.promptTitle')}
        </Text>
        <Text variant="body" color="secondary" style={{ textAlign: 'center' }}>
          {t('notifications.promptBody')}
        </Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button label={t('notifications.promptEnable')} onPress={handleEnable} fullWidth />
          <Button
            label={t('notifications.promptLater')}
            variant="ghost"
            onPress={() => sheetRef.current?.dismiss()}
            fullWidth
          />
        </View>
      </View>
    </SheetModal>
  );
}
