import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { initI18n } from '@/i18n';

import { ConnectionErrorCard } from './connection-error-card';
import { RealtimeControlsContext } from './realtime-context';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';

beforeAll(() => {
  initI18n();
});

describe('ConnectionErrorCard', () => {
  beforeEach(() => resetConnectionStore());

  it('renders nothing while the connection is not failed', async () => {
    await render(<ConnectionErrorCard />);
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('explains a revoked failure and retries through the provider controls', async () => {
    const retry = jest.fn();
    await render(
      <RealtimeControlsContext.Provider value={{ retry }}>
        <ConnectionErrorCard />
      </RealtimeControlsContext.Provider>,
    );
    await act(async () => {
      useConnectionStore.getState().markFailed('revoked');
    });

    expect(screen.getByText(/no longer have access/)).toBeTruthy();
    fireEvent.press(screen.getByText('Retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
