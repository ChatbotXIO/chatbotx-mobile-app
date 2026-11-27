import { findTrackedClientId, useSendStatusStore } from './use-send-status-store';

describe('useSendStatusStore', () => {
  beforeEach(() => useSendStatusStore.setState({ sends: {} }));

  it('tracks a send, attaches its server id, and stops tracking it', () => {
    const store = useSendStatusStore.getState();
    store.startTracking('c-1', 'conv-a');
    store.attachMessageId('c-1', 'm-1');
    expect(useSendStatusStore.getState().sends).toEqual({
      'c-1': { conversationId: 'conv-a', messageId: 'm-1' },
    });

    store.stopTracking('c-1');
    expect(useSendStatusStore.getState().sends).toEqual({});
  });

  it('ignores a server id for a send that was already settled', () => {
    useSendStatusStore.getState().attachMessageId('c-1', 'm-1');
    expect(useSendStatusStore.getState().sends).toEqual({});
  });
});

describe('findTrackedClientId', () => {
  const sends = { 'c-1': { conversationId: 'conv-a', messageId: 'm-1' } };

  it('matches by clientId first', () => {
    expect(findTrackedClientId(sends, { clientId: 'c-1', messageId: 'other' })).toBe('c-1');
  });

  it('falls back to the server message id', () => {
    expect(findTrackedClientId(sends, { messageId: 'm-1' })).toBe('c-1');
  });

  it('returns null for a message this device is not waiting on', () => {
    expect(findTrackedClientId(sends, { clientId: 'c-9', messageId: 'm-9' })).toBeNull();
  });
});
