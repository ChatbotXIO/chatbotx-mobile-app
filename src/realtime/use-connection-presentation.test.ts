import { act, renderHook } from '@testing-library/react-native';

import { CONNECTION_GRACE_MS, useConnectionPresentation } from './use-connection-presentation';
import { resetConnectionStore, useConnectionStore } from './use-connection-store';

describe('useConnectionPresentation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetConnectionStore();
    useConnectionStore.setState({ isNetworkReachable: true });
  });
  afterEach(() => jest.useRealTimers());

  it('hides a degraded state until the grace period elapses (no cold-start flash)', async () => {
    const { result } = await renderHook(() => useConnectionPresentation());
    expect(result.current).toBe('online');
    await act(async () => {
      jest.advanceTimersByTime(CONNECTION_GRACE_MS - 1);
    });
    expect(result.current).toBe('online');
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('connecting');
  });

  it('never surfaces a drop that recovers inside the grace window', async () => {
    const { result } = await renderHook(() => useConnectionPresentation());
    await act(async () => {
      useConnectionStore.getState().markOpened();
    });
    await act(async () => {
      useConnectionStore.getState().setStatus('closed');
    });
    await act(async () => {
      jest.advanceTimersByTime(CONNECTION_GRACE_MS - 100);
    });
    await act(async () => {
      useConnectionStore.getState().markOpened();
    });
    await act(async () => {
      jest.advanceTimersByTime(CONNECTION_GRACE_MS * 2);
    });
    expect(result.current).toBe('online');
  });

  it('shows recovery immediately and restarts the grace window for the next drop', async () => {
    const { result } = await renderHook(() => useConnectionPresentation());
    await act(async () => {
      useConnectionStore.getState().markOpened();
    });
    await act(async () => {
      useConnectionStore.getState().setStatus('closed');
    });
    await act(async () => {
      jest.advanceTimersByTime(CONNECTION_GRACE_MS);
    });
    expect(result.current).toBe('reconnecting');
    await act(async () => {
      useConnectionStore.getState().markOpened();
    });
    expect(result.current).toBe('online');
    await act(async () => {
      useConnectionStore.getState().setStatus('closed');
    });
    expect(result.current).toBe('online');
  });

  it('shows a terminal failure immediately', async () => {
    const { result } = await renderHook(() => useConnectionPresentation());
    await act(async () => {
      useConnectionStore.getState().markFailed('auth');
    });
    expect(result.current).toBe('failed');
  });
});
