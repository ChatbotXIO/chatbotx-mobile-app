import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { createAppleNonce, signInWithAppleIdToken } from '@/api/auth-endpoints';
import { initI18n } from '@/i18n';

import { AppleSignInButton } from './apple-sign-in-button';

jest.mock('expo-apple-authentication', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppleAuthenticationButton: (props: { onPress: () => void }) => (
      <View testID="apple-button" onTouchEnd={props.onPress} />
    ),
    AppleAuthenticationButtonStyle: { BLACK: 2, WHITE: 0 },
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    isAvailableAsync: jest.fn(),
    signInAsync: jest.fn(),
  };
});
jest.mock('@/api/auth-endpoints', () => ({
  AuthApiError: class AuthApiError extends Error {},
  createAppleNonce: jest.fn(),
  signInWithAppleIdToken: jest.fn(),
}));

const user = { id: 'u1', email: 'a@b.test', name: 'Ada', mustChangePassword: false };

async function setup() {
  const props = {
    disabled: false,
    onBusyChange: jest.fn(),
    onSignedIn: jest.fn(),
    onError: jest.fn(),
  };
  await render(<AppleSignInButton {...props} />);
  return { props };
}

async function press() {
  await act(async () => {
    fireEvent(await screen.findByTestId('apple-button'), 'touchEnd');
  });
}

beforeAll(() => {
  initI18n();
});

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(createAppleNonce).mockResolvedValue({ raw: 'raw', hashed: 'hashed' });
});

describe('AppleSignInButton', () => {
  it('renders nothing when Sign in with Apple is unavailable', async () => {
    jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(false);
    await setup();
    await waitFor(() => expect(AppleAuthentication.isAvailableAsync).toHaveBeenCalled());

    expect(screen.queryByTestId('apple-button')).toBeNull();
  });

  it('renders nothing on Android', async () => {
    Platform.OS = 'android';
    await setup();

    expect(screen.queryByTestId('apple-button')).toBeNull();
    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('shows no error when the user cancels', async () => {
    jest
      .mocked(AppleAuthentication.signInAsync)
      .mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }));
    const { props } = await setup();

    await press();

    expect(props.onError).toHaveBeenCalledTimes(1);
    expect(props.onError).toHaveBeenCalledWith(null);
    expect(props.onSignedIn).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('sends the hashed nonce to Apple and the raw nonce to the API', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
      identityToken: 'id-token',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    } as AppleAuthentication.AppleAuthenticationCredential);
    jest.mocked(signInWithAppleIdToken).mockResolvedValue(user);
    const { props } = await setup();

    await press();

    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'hashed' }),
    );
    expect(signInWithAppleIdToken).toHaveBeenCalledWith({
      idToken: 'id-token',
      nonce: 'raw',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
    expect(props.onSignedIn).toHaveBeenCalledWith(user);
  });

  it('reports an error when Apple returns no identity token', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValue({
      identityToken: null,
      fullName: null,
    } as AppleAuthentication.AppleAuthenticationCredential);
    const { props } = await setup();

    await press();

    expect(signInWithAppleIdToken).not.toHaveBeenCalled();
    expect(props.onError).toHaveBeenLastCalledWith(expect.any(String));
    expect(props.onSignedIn).not.toHaveBeenCalled();
  });
});
