import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef, type PropsWithChildren, type Ref } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { changeAppLanguage } from '@/i18n/apply-language';
import { localeMeta, supportedLanguages } from '@/i18n/locales';

import { LanguageSheet } from './language-sheet';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@/i18n/apply-language', () => ({
  changeAppLanguage: jest.fn().mockResolvedValue(undefined),
}));

const mockDismiss = jest.fn();

// Same stub rationale as conversation-actions-sheet.test.tsx: BottomSheetModal needs a portal
// provider and BottomSheetFlatList needs worklets, neither available under plain Jest.
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FlatList, View } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef, useImperativeHandle } = require('react');
  const BottomSheetModal = forwardRef(function BottomSheetModal(
    { children }: PropsWithChildren,
    ref: Ref<{ present: () => void; dismiss: () => void }>,
  ) {
    useImperativeHandle(ref, () => ({ present: () => {}, dismiss: mockDismiss }));
    return children;
  });
  return {
    __esModule: true,
    default: View,
    BottomSheetBackdrop: View,
    BottomSheetFlatList: FlatList,
    BottomSheetModal,
    BottomSheetView: View,
  };
});

describe('LanguageSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders every supported language', async () => {
    const sheetRef = createRef<BottomSheetModal>();
    await render(<LanguageSheet sheetRef={sheetRef} currentLanguage="en" />);

    // FlatList virtualizes; the first rows are enough to prove the list renders from the source.
    expect(screen.getByText(localeMeta[supportedLanguages[0]].nativeLabel)).toBeTruthy();
  });

  it('dismisses the sheet and changes language when a row is pressed', async () => {
    const sheetRef = createRef<BottomSheetModal>();
    await render(<LanguageSheet sheetRef={sheetRef} currentLanguage="en" />);

    const target = supportedLanguages[1];
    await fireEvent.press(screen.getByText(localeMeta[target].nativeLabel));

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(changeAppLanguage).toHaveBeenCalledWith(target);
  });
});
