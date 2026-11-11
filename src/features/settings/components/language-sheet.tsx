import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { SheetModal } from '@/components/ui/sheet';
import { changeAppLanguage } from '@/i18n/apply-language';
import { localeMeta, supportedLanguages, type SupportedLanguage } from '@/i18n/locales';
import { useTheme } from '@/theme/use-theme';

interface LanguageSheetProps {
  sheetRef: RefObject<BottomSheetModal | null>;
  currentLanguage: SupportedLanguage;
}

export function LanguageSheet({ sheetRef, currentLanguage }: LanguageSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <SheetModal ref={sheetRef} snapPoints={['90%']} scrollable>
      <BottomSheetFlatList
        data={supportedLanguages}
        keyExtractor={(language) => language}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
        renderItem={({ item: language }) => (
          <ListItem
            title={localeMeta[language].nativeLabel}
            trailing={
              language === currentLanguage ? (
                <View>
                  <Icon name="check" size={20} color={colors.brand} />
                </View>
              ) : undefined
            }
            onPress={() => {
              sheetRef.current?.dismiss();
              void changeAppLanguage(language);
            }}
          />
        )}
      />
    </SheetModal>
  );
}
