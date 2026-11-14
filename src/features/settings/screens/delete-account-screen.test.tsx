import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/errors';
import { initI18n } from '@/i18n';

import { DeleteAccountScreen } from './delete-account-screen';

const mockMutateAsync = jest.fn();
const mockShowToast = jest.fn();
let mockState: { isPending: boolean; isError: boolean; error: unknown } = {
  isPending: false,
  isError: false,
  error: null,
};

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('@/components/ui/toast', () => ({ useToast: () => mockShowToast }));
jest.mock('@/features/settings/api/use-delete-account', () => ({
  ACCOUNT_DELETION_CONFIRMATION: 'DELETE',
  ACCOUNT_DELETION_SUPPORT_REQUIRED_CODE: 'accountDeletionSupportRequired',
  useDeleteAccount: () => ({ ...mockState, mutateAsync: mockMutateAsync }),
}));

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
  mockState = { isPending: false, isError: false, error: null };
});

async function typeAndSubmit(value: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('DELETE'), value);
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: /delete my account/i }));
  });
}

describe('DeleteAccountScreen', () => {
  it('keeps the submit button disabled until DELETE is typed exactly', async () => {
    await render(<DeleteAccountScreen />);

    await typeAndSubmit('delete');
    expect(mockMutateAsync).not.toHaveBeenCalled();

    await typeAndSubmit('DELETE');
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('shows the scheduled toast once the deletion succeeds', async () => {
    await render(<DeleteAccountScreen />);

    await typeAndSubmit('DELETE');

    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/scheduled for deletion/i) }),
    );
  });

  it('does not toast when the deletion fails', async () => {
    mockMutateAsync.mockRejectedValue(new ApiError({ status: 500 }));
    await render(<DeleteAccountScreen />);

    await typeAndSubmit('DELETE');

    expect(mockShowToast).not.toHaveBeenCalled();
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

  it('shows the network message when the request never reached the server', async () => {
    mockState = {
      isPending: false,
      isError: true,
      error: new TypeError('Network request failed'),
    };
    await render(<DeleteAccountScreen />);

    expect(screen.getByText(/check your internet connection/i)).toBeTruthy();
  });

  it('shows a generic message for other errors', async () => {
    mockState = { isPending: false, isError: true, error: new ApiError({ status: 500 }) };
    await render(<DeleteAccountScreen />);

    expect(screen.getByText(/couldn.t delete your account/i)).toBeTruthy();
  });
});
