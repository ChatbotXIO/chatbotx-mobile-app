import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { useSettingsStore } from '@/stores/use-settings-store';

import { usePushPrompt } from './use-push-prompt';

const mockMutate = jest.fn();

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: jest.fn() }));
jest.mock('@/features/settings/api/use-device-token', () => ({
  useRegisterDeviceToken: () => ({ mutate: mockMutate }),
}));

function mockPermission(status: 'granted' | 'denied' | 'undetermined') {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status } as never);
}

async function renderWithSheet() {
  const present = jest.fn();
  const rendered = await renderHook(() => {
    const prompt = usePushPrompt('ws-1');
    // Attached during render so it is in place before the hook's effect runs.
    (prompt.sheetRef as { current: unknown }).current = { present };
    return prompt;
  });
  return { ...rendered, present };
}

beforeEach(() => {
  jest.clearAllMocks();
  (Device as { isDevice: boolean }).isDevice = true;
  useSettingsStore.setState({
    pushEnabled: false,
    pushPromptDismissCount: 0,
    pushPromptLastDismissedAt: null,
  });
});

describe('usePushPrompt', () => {
  it('presents the sheet when permission is undecided', async () => {
    mockPermission('undetermined');
    const { present } = await renderWithSheet();

    await waitFor(() => expect(present).toHaveBeenCalledTimes(1));
  });

  it.each(['granted', 'denied'] as const)('stays hidden when permission is %s', async (status) => {
    mockPermission(status);
    const { present } = await renderWithSheet();

    await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
    expect(present).not.toHaveBeenCalled();
  });

  it('stays hidden when the user already dismissed it moments ago', async () => {
    mockPermission('undetermined');
    useSettingsStore.setState({ pushPromptDismissCount: 1, pushPromptLastDismissedAt: Date.now() });
    const { present } = await renderWithSheet();

    await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
    expect(present).not.toHaveBeenCalled();
  });

  it('records a dismissal on "later"', async () => {
    mockPermission('granted');
    const { result } = await renderWithSheet();

    await act(async () => result.current.handleLater());

    expect(useSettingsStore.getState().pushPromptDismissCount).toBe(1);
  });

  it('enables push intent only after the token registers, and clears it on failure', async () => {
    mockPermission('granted');
    const { result } = await renderWithSheet();

    await act(async () => result.current.handleEnable());
    const [, callbacks] = mockMutate.mock.calls[0] as [
      undefined,
      { onSuccess: () => void; onError: () => void },
    ];

    expect(useSettingsStore.getState().pushEnabled).toBe(false);
    await act(async () => callbacks.onSuccess());
    expect(useSettingsStore.getState().pushEnabled).toBe(true);
    await act(async () => callbacks.onError());
    expect(useSettingsStore.getState().pushEnabled).toBe(false);
  });
});
