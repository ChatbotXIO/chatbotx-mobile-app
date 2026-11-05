import { createRealtimeConnection } from './realtime-connection';
import { REALTIME_CLOSE_CODE, RealtimeFatalError } from './protocol/realtime-socket';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  serverClose(code: number, reason = '') {
    this.onclose?.({ code, reason });
  }
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

function setup(getUrl?: (lastSeq: string | null) => Promise<string>) {
  const handlers = {
    getUrl: jest.fn(getUrl ?? (async (seq: string | null) => `ws://x?lastSeq=${seq ?? ''}`)),
    onEvent: jest.fn(),
    onStatus: jest.fn(),
    onOpen: jest.fn(),
    onResync: jest.fn(),
    onRevoked: jest.fn(),
    onFailed: jest.fn(),
  };
  const connection = createRealtimeConnection({
    ...handlers,
    socketOptions: {
      webSocketFactory: (url) => new FakeSocket(url) as never,
      random: () => 0,
    },
  });
  return { connection, handlers };
}

const batch = (seq: string, data: unknown = { messageIds: ['m1'] }) =>
  JSON.stringify({ seq, batch: [{ eventType: 'messageDeleted', data }] });

describe('createRealtimeConnection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances = [];
  });
  afterEach(() => jest.useRealTimers());

  it('dispatches events from accepted frames and skips unknown types', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    const socket = FakeSocket.instances[0]!;
    socket.onopen?.();
    socket.onmessage?.({
      data: JSON.stringify({
        seq: '1-0',
        batch: [
          { eventType: 'pipelineItemChanged', data: {} },
          { eventType: 'messageDeleted', data: { messageIds: ['m1'] } },
        ],
      }),
    });
    expect(handlers.onEvent).toHaveBeenCalledTimes(1);
    expect(handlers.onResync).not.toHaveBeenCalled();
    expect(handlers.onOpen).toHaveBeenCalledWith({ hasCursor: false });
  });

  it('requests a resync when a handled event fails validation', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.onmessage?.({ data: batch('1-0', {}) });
    expect(handlers.onResync).toHaveBeenCalledTimes(1);
  });

  it('4001 stops for good, even on resume', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.serverClose(REALTIME_CLOSE_CODE.revoked);
    jest.advanceTimersByTime(60_000);
    await flush();
    connection.resume();
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(handlers.onRevoked).toHaveBeenCalledTimes(1);
  });

  it('4002 clears the cursor, refetches, and reconnects without lastSeq', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    const first = FakeSocket.instances[0]!;
    first.onmessage?.({ data: batch('7-0') });
    first.serverClose(REALTIME_CLOSE_CODE.resync);
    expect(handlers.onResync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeSocket.instances[1]!.url).toBe('ws://x?lastSeq=');
  });

  it('4004 reconnects with a freshly minted URL and keeps the cursor', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    const first = FakeSocket.instances[0]!;
    first.onmessage?.({ data: batch('7-0') });
    first.serverClose(REALTIME_CLOSE_CODE.reauth);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(handlers.getUrl).toHaveBeenLastCalledWith('7-0');
    expect(FakeSocket.instances[1]!.url).toBe('ws://x?lastSeq=7-0');
    expect(handlers.onResync).not.toHaveBeenCalled();
  });

  it('4003 waits the server-provided retryAfter', async () => {
    const { connection } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.serverClose(
      REALTIME_CLOSE_CODE.overloaded,
      JSON.stringify({ retryAfter: 5000 }),
    );
    jest.advanceTimersByTime(4999);
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(2);
    await flush();
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('stops entirely when minting the URL fails permanently', async () => {
    const { connection, handlers } = setup(async () => {
      throw new RealtimeFatalError('forbidden');
    });
    connection.start();
    await flush();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(handlers.onStatus).toHaveBeenLastCalledWith('closed');
  });

  it('resume after stop opens a new socket that keeps the replay cursor', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.onmessage?.({ data: batch('3-0') });
    connection.stop();
    connection.resume();
    await flush();
    expect(handlers.getUrl).toHaveBeenLastCalledWith('3-0');
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('reports connecting on every automatic retry, not just the first attempt', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.serverClose(1006);
    expect(handlers.onStatus).toHaveBeenLastCalledWith('closed');
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(handlers.onStatus).toHaveBeenLastCalledWith('connecting');
  });

  it('reports closed on a deliberate stop, since the socket never fires onClose for it', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.onopen?.();
    connection.stop();
    expect(handlers.onStatus).toHaveBeenLastCalledWith('closed');
  });

  it('reports a revoked close as a terminal failure', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.serverClose(REALTIME_CLOSE_CODE.revoked);
    expect(handlers.onFailed).toHaveBeenCalledWith('revoked');
  });

  it('reports a permanent token-mint failure and does not revive on resume', async () => {
    const { connection, handlers } = setup(async () => {
      throw new RealtimeFatalError('forbidden');
    });
    connection.start();
    await flush();
    expect(handlers.onFailed).toHaveBeenCalledWith('auth');
    connection.resume();
    await flush();
    expect(handlers.getUrl).toHaveBeenCalledTimes(1);
  });

  it('retry rebuilds the socket after a revoked close', async () => {
    const { connection, handlers } = setup();
    connection.start();
    await flush();
    FakeSocket.instances[0]!.serverClose(REALTIME_CLOSE_CODE.revoked);
    connection.retry();
    await flush();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(handlers.onStatus).toHaveBeenLastCalledWith('connecting');
  });
});
