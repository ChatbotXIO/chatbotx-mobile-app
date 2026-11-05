import {
  deriveConnectionPresentation,
  resetConnectionStore,
  useConnectionStore,
} from './use-connection-store';

describe('deriveConnectionPresentation', () => {
  const base = { status: 'connecting', isNetworkReachable: true, hasEverOpened: false } as const;

  it('is online only when the socket is open', () => {
    expect(deriveConnectionPresentation({ ...base, status: 'open' })).toBe('online');
  });

  it('is connecting on the first connect and reconnecting after a drop', () => {
    expect(deriveConnectionPresentation(base)).toBe('connecting');
    expect(deriveConnectionPresentation({ ...base, hasEverOpened: true })).toBe('reconnecting');
    expect(deriveConnectionPresentation({ ...base, status: 'closed', hasEverOpened: true })).toBe(
      'reconnecting',
    );
  });

  it('is waiting-network whenever the device is unreachable and the socket is not open', () => {
    expect(deriveConnectionPresentation({ ...base, isNetworkReachable: false })).toBe(
      'waiting-network',
    );
  });

  it('treats unknown reachability as reachable', () => {
    expect(deriveConnectionPresentation({ ...base, isNetworkReachable: null })).toBe('connecting');
  });

  it('failed wins over everything else', () => {
    expect(
      deriveConnectionPresentation({ ...base, status: 'failed', isNetworkReachable: false }),
    ).toBe('failed');
  });
});

describe('useConnectionStore', () => {
  beforeEach(() => {
    resetConnectionStore();
    useConnectionStore.setState({ isNetworkReachable: null });
  });

  it('records the failure reason and clears it when a new attempt starts', () => {
    useConnectionStore.getState().markFailed('revoked');
    expect(useConnectionStore.getState()).toMatchObject({
      status: 'failed',
      failureReason: 'revoked',
    });
    useConnectionStore.getState().setStatus('connecting');
    expect(useConnectionStore.getState()).toMatchObject({
      status: 'connecting',
      failureReason: null,
    });
  });

  it('reset keeps device reachability', () => {
    useConnectionStore.getState().setNetworkReachable(false);
    useConnectionStore.getState().markOpened();
    resetConnectionStore();
    expect(useConnectionStore.getState()).toMatchObject({
      status: 'connecting',
      hasEverOpened: false,
      isNetworkReachable: false,
    });
  });
});
