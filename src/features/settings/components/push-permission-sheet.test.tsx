import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef, type PropsWithChildren, type Ref } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { initI18n } from '@/i18n';

import { PushPermissionSheet } from './push-permission-sheet';

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockDismiss = jest.fn();
let mockOnDismiss: (() => void) | undefined;

// Same stub rationale as language-sheet.test.tsx. `dismiss` also fires the modal's `onDismiss`,
// as the real BottomSheetModal does once it has finished closing.
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef, useImperativeHandle } = require('react');
  const BottomSheetModal = forwardRef(function BottomSheetModal(
    { children, onDismiss }: PropsWithChildren<{ onDismiss?: () => void }>,
    ref: Ref<{ present: () => void; dismiss: () => void }>,
  ) {
    mockOnDismiss = onDismiss;
    useImperativeHandle(ref, () => ({
      present: () => {},
      dismiss: () => {
        mockDismiss();
        onDismiss?.();
      },
    }));
    return children;
  });
  return {
    __esModule: true,
    default: View,
    BottomSheetBackdrop: View,
    BottomSheetModal,
    BottomSheetView: View,
  };
});

beforeAll(() => {
  initI18n();
});

describe('PushPermissionSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enables push and dismisses without counting it as a "later"', async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const onEnable = jest.fn();
    const onLater = jest.fn();
    await render(<PushPermissionSheet sheetRef={sheetRef} onEnable={onEnable} onLater={onLater} />);

    await fireEvent.press(screen.getByText('Turn on notifications'));

    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(onLater).not.toHaveBeenCalled();
  });

  it('reports "later" when the Later button is pressed', async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const onEnable = jest.fn();
    const onLater = jest.fn();
    await render(<PushPermissionSheet sheetRef={sheetRef} onEnable={onEnable} onLater={onLater} />);

    await fireEvent.press(screen.getByText('Not now'));

    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onEnable).not.toHaveBeenCalled();
  });

  it('reports "later" when the sheet is swiped away', async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const onLater = jest.fn();
    await render(
      <PushPermissionSheet sheetRef={sheetRef} onEnable={jest.fn()} onLater={onLater} />,
    );

    mockOnDismiss?.();

    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
