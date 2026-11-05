import { parseRealtimeEnvelope, isRealtimeEnvelope } from './parse-event';
import type { RealtimeEventData } from './events';
import { createRealtimeFrameReader, parseBatchFrame } from './protocol/frame-reader';
import { REALTIME_CLOSE_CODE, RealtimeSocket } from './protocol/realtime-socket';

export type RealtimeConnectionStatus = 'connecting' | 'open' | 'closed';

type RealtimeSocketOptions = ConstructorParameters<typeof RealtimeSocket>[0];

export interface RealtimeConnectionOptions {
  /** Mints a fresh connect URL (token included). Receives the replay cursor to resume from, or
   * `null` for a fresh stream. Throw `RealtimeFatalError` when the failure is permanent. */
  getUrl: (lastSeq: string | null) => Promise<string>;
  onEvent: (event: RealtimeEventData) => void;
  onStatus: (status: RealtimeConnectionStatus) => void;
  /** Fires on every successful open. `hasCursor` is false when no frame was ever accepted, so
   * events missed while disconnected can't be replayed and caches need a refetch. */
  onOpen: (info: { hasCursor: boolean }) => void;
  /** The stream can't be resumed (server `resync` close, or a malformed frame): the cursor was
   * cleared and every cache must be refetched. */
  onResync: () => void;
  /** Membership was removed (close code 4001): the socket stays closed. */
  onRevoked?: () => void;
  onDiagnostic?: (error: unknown) => void;
  /** Test seams. */
  socketOptions?: Partial<Omit<RealtimeSocketOptions, 'getUrl' | 'onMessage'>>;
}

export interface RealtimeConnection {
  start: () => void;
  stop: () => void;
  /** Reconnects after a background period; starts a new socket when the old one was stopped. */
  resume: () => void;
}

/**
 * Wires the vendored socket and frame reader into one workspace connection. Close handling:
 * 4001 stops for good, 4002 clears the cursor and refetches, 4003 waits the server's retryAfter,
 * 4004 reconnects with a freshly minted token while keeping the cursor.
 */
export function createRealtimeConnection(options: RealtimeConnectionOptions): RealtimeConnection {
  let socket: RealtimeSocket | null = null;
  let revoked = false;

  const reader = createRealtimeFrameReader<Record<string, unknown>>({
    parseBatch: (value) => parseBatchFrame(value, isRealtimeEnvelope),
    onParseError: (error) => options.onDiagnostic?.(error),
    onResyncNeeded: () => {
      reader.reset();
      options.onResync();
    },
  });

  function handleMessage(data: string): void {
    const batch = reader.readFrame(data);
    if (!batch) return;
    for (const envelope of batch) {
      const result = parseRealtimeEnvelope(envelope);
      if (result.status === 'ok') {
        options.onEvent(result.event);
      } else if (result.status === 'invalid') {
        reader.reportInvalidEvent();
      }
    }
  }

  function create(): void {
    const created = new RealtimeSocket({
      ...options.socketOptions,
      getUrl: () => options.getUrl(reader.getLastSeq()),
      onMessage: handleMessage,
      onOpen: () => {
        options.onStatus('open');
        options.onOpen({ hasCursor: reader.getLastSeq() !== null });
      },
      onClose: (event) => {
        options.onStatus('closed');
        if (event.code === REALTIME_CLOSE_CODE.revoked) {
          revoked = true;
          options.onRevoked?.();
        }
      },
      onResync: () => {
        reader.reset();
        options.onResync();
      },
      onError: (error) => {
        options.onStatus('closed');
        options.onDiagnostic?.(error);
      },
    });
    socket = created;
    options.onStatus('connecting');
    created.connect();
  }

  return {
    start: create,
    stop: () => {
      socket?.close();
      socket = null;
    },
    resume: () => {
      // A revoked membership never reconnects, not even on foreground.
      if (revoked) return;
      if (socket) {
        socket.reconnectNow();
      } else {
        create();
      }
    },
  };
}
