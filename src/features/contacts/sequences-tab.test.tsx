import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { initI18n } from '@/i18n';
import type { ContactDetail } from '@/features/contacts/api/use-contact-detail';

import { SequencesTab } from './sequences-tab';

const mockMutate = jest.fn();

jest.mock('@/features/sequences/api/use-unenroll-contact-from-sequences', () => ({
  useUnenrollContactFromSequences: () => ({ mutate: mockMutate }),
}));
jest.mock('@/features/sequences/components/sequence-picker-sheet', () => ({
  SequencePickerSheet: () => null,
}));
jest.mock('@/components/ui/toast', () => ({
  useToast: () => jest.fn(),
}));

beforeAll(() => {
  initI18n();
});

afterEach(() => {
  jest.restoreAllMocks();
  mockMutate.mockReset();
});

function fakeContact(): ContactDetail {
  return {
    id: 'contact-1',
    sequences: [{ sequenceId: 'seq-1', sequenceName: 'Onboarding' }],
  } as unknown as ContactDetail;
}

type AlertButtons = { text: string; style?: string; onPress?: () => void }[];

describe('SequencesTab', () => {
  it('asks to unenroll on long-press and unenrolls once confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<SequencesTab contact={fakeContact()} workspaceId="ws-1" />);

    fireEvent(screen.getByLabelText('Onboarding'), 'longPress');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[1]).toContain('Onboarding');
    expect(mockMutate).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0]?.[2] as AlertButtons;
    buttons.find((button) => button.style === 'destructive')?.onPress?.();
    expect(mockMutate).toHaveBeenCalledWith('seq-1', expect.any(Object));
  });

  it('exposes an unenroll accessibility action that opens the same confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<SequencesTab contact={fakeContact()} workspaceId="ws-1" />);

    const row = screen.getByLabelText('Onboarding');
    expect(row.props.accessibilityActions).toEqual([{ name: 'unenroll', label: 'Unsubscribe' }]);

    fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'unenroll' } });
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });

  it('offers no unenroll action without a workspace', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<SequencesTab contact={fakeContact()} workspaceId={null} />);

    const row = screen.getByLabelText('Onboarding');
    expect(row.props.accessibilityActions).toEqual([]);
    fireEvent(row, 'longPress');
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
