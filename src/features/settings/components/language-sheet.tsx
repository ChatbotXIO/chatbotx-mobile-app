import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';
import { Sheet } from '@/components/ui/sheet';
import { changeAppLanguage } from '@/i18n/apply-language';
import { localeMeta, supportedLanguages, type SupportedLanguage } from '@/i18n/locales';
import { useTheme } from '@/theme/use-theme';

interface LanguageSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
  currentLanguage: SupportedLanguage;
}

export function LanguageSheet({ sheetRef, currentLanguage }: LanguageSheetProps) {
  const { colors } = useTheme();

  return (
    <Sheet ref={sheetRef} snapPoints={['60%', '90%']}>
      <BottomSheetFlatList
        data={supportedLanguages}
        keyExtractor={(language) => language}
        renderItem={({ item: language }) => (
          <ListItem
            title={localeMeta[language].nativeLabel}
            trailing={
              language === currentLanguage ? (
                <View>
                  <Icon name="checkmark" size={20} color={colors.primary} />
                </View>
              ) : undefined
            }
            onPress={() => {
              sheetRef.current?.close();
              void changeAppLanguage(language);
            }}
          />
        )}
      />
    </Sheet>
  );
}
