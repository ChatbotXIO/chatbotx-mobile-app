import { act, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';
import { CONNECTION_GRACE_MS } from '@/realtime/use-connection-presentation';
import { resetConnectionStore, useConnectionStore } from '@/realtime/use-connection-store';

import { ConnectionTitle } from './connection-title';

beforeAll(() => {
  initI18n();
});

describe('ConnectionTitle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetConnectionStore();
    useConnectionStore.setState({ isNetworkReachable: true });
  });
  afterEach(() => jest.useRealTimers());

  it('shows the title, not a status, during the cold-start grace window', async () => {
    await render(<ConnectionTitle title="Inbox" />);
    expect(screen.getByText('Inbox')).toBeTruthy();
    expect(screen.queryByText('Connecting…')).toBeNull();
  });

  it('swaps to "Connecting…" once the grace period passes, then back to the title when open', async () => {
    await render(<ConnectionTitle title="Inbox" />);
    await act(async () => {
      jest.advanceTimersByTime(CONNECTION_GRACE_MS);
    });
    expect(screen.getByText('Connecting…')).toBeTruthy();
    expect(screen.queryByText('Inbox')).toBeNull();

    await act(async () => {
      useConnectionStore.getState().markOpened();
    });
    expect(screen.getByText('Inbox')).toBeTruthy();
  });

  it('shows "Waiting for network…" when the device is offline', async () => {
    await render(<ConnectionTitle title="Inbox" />);
    await act(async () => {
      useConnectionStore.getState().setNetworkReachable(false);
      jest.advanceTimersByTime(CONNECTION_GRACE_MS);
    });
    expect(screen.getByText('Waiting for network…')).toBeTruthy();
  });

  it('shows "Updating…" after a drop following a successful connect', async () => {
    await render(<ConnectionTitle title="Inbox" />);
    await act(async () => {
      useConnectionStore.getState().markOpened();
      useConnectionStore.getState().setStatus('closed');
      jest.advanceTimersByTime(CONNECTION_GRACE_MS);
    });
    expect(screen.getByText('Updating…')).toBeTruthy();
  });

  it('keeps the title on a terminal failure (the error card explains it)', async () => {
    await render(<ConnectionTitle title="Inbox" />);
    await act(async () => {
      useConnectionStore.getState().markFailed('revoked');
    });
    expect(screen.getByText('Inbox')).toBeTruthy();
  });
});
