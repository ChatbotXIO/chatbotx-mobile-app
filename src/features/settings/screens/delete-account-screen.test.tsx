import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { initI18n } from '@/i18n';

import DeleteAccountScreen from '@/app/(app)/settings/delete-account';

const mockMutate = jest.fn();
let mockState: { isPending: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isError: false,
  error: null,
};

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/components/ui/toast', () => ({ useToast: () => jest.fn() }));
jest.mock('@/features/settings/api/use-delete-account', () => ({
  ACCOUNT_DELETION_CONFIRMATION: 'DELETE',
  ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE: 'accountDeletionSupportRequired',
  useDeleteAccount: () => ({ ...mockState, mutate: mockMutate }),
}));

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { isPending: false, isError: false, error: null };
});

describe('DeleteAccountScreen', () => {
  it('keeps the submit button disabled until DELETE is typed exactly', async () => {
    await render(<DeleteAccountScreen />);
    const input = screen.getByPlaceholderText('DELETE');

    await fireEvent.changeText(input, 'delete');
    await fireEvent.press(screen.getByRole('button', { name: /delete my account/i }));
    expect(mockMutate).not.toHaveBeenCalled();

    await fireEvent.changeText(input, 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: /delete my account/i }));
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('shows the contact-support message for accountDeletionSupportRequired', async () => {
    mockState = {
      isPending: false,
      isError: true,
      error: new ApiError({ code: 'accountDeletionSupportRequired', status: 403 }),
    };
    await render(<DeleteAccountScreen />);

    expect(screen.getByText(/contact support/i)).toBeTruthy();
  });

  it('shows a generic message for other errors', async () => {
    mockState = { isPending: false, isError: true, error: new ApiError({ status: 500 }) };
    await render(<DeleteAccountScreen />);

    expect(screen.getByText(/couldn.t delete your account/i)).toBeTruthy();
  });
});
