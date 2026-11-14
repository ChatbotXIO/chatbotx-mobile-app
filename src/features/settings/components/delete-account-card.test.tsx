import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { initI18n } from '@/i18n';

import { DeleteAccountCard } from './delete-account-card';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeAll(() => {
  initI18n();
});

describe('DeleteAccountCard', () => {
  it('shows the warning copy and the delete action', async () => {
    await render(<DeleteAccountCard />);

    expect(screen.getByText(/permanently delete your account/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeTruthy();
  });

  it('opens the in-app delete-account screen when pressed', async () => {
    await render(<DeleteAccountCard />);

    fireEvent.press(screen.getByRole('button', { name: /delete account/i }));

    expect(router.push).toHaveBeenCalledWith('/(app)/settings/delete-account');
  });
});
