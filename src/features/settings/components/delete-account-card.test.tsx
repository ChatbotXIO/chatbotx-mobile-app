import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { initI18n } from '@/i18n';

import { DeleteAccountCard } from './delete-account-card';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('@/config/account-urls', () => ({
  ACCOUNT_DELETE_URL: 'https://app.example.test/account/delete',
}));

beforeAll(() => {
  initI18n();
});

describe('DeleteAccountCard', () => {
  it('shows the warning copy and the delete action', async () => {
    await render(<DeleteAccountCard />);

    expect(screen.getByText(/permanently delete your account/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeTruthy();
  });

  it('opens the web delete-account page when pressed', async () => {
    await render(<DeleteAccountCard />);

    fireEvent.press(screen.getByRole('button', { name: /delete account/i }));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://app.example.test/account/delete',
    );
  });
});
