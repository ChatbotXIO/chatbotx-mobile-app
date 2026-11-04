import { isRealtimeSeqAfter, STREAM_ID_PATTERN } from './stream';

export interface BatchFrame<TEnvelope> {
  batch: TEnvelope[];
  seq: string;
}

export interface RealtimeFrameReader<TEnvelope> {
  /** Resume cursor of the last frame `readFrame` accepted, or `null` before the first one. */
  getLastSeq: () => string | null;
  /**
   * Parses one wire frame. Returns the batch's envelopes (already deduped against this reader's
   * `seq` cursor) for the caller to dispatch, or `null` when there is nothing to dispatch: a
   * heartbeat, a malformed frame (which also requests a throttled resync), or a stale/duplicate
   * `seq`.
   */
  readFrame: (data: string) => TEnvelope[] | null;
  /** Signals an invalid event found after `readFrame` returned; shares the throttled resync. */
  reportInvalidEvent: () => void;
  /** Clears the cursor — call on a fresh connection or after a resync. */
  reset: () => void;
}

interface FrameReaderOptions<TEnvelope> {
  onParseError: (error: unknown) => void;
  onResyncNeeded: () => void;
  /** Validates a parsed JSON value as a batch frame; return `null` when it is not one. */
  parseBatch: (value: unknown) => BatchFrame<TEnvelope> | null;
  /** Overridable for tests only. */
  resyncThrottleMs?: number;
}

const DEFAULT_RESYNC_THROTTLE_MS = 2000;

/** Type guard for the `{ batch, seq }` wire shape, with a per-item envelope guard. */
export function parseBatchFrame<TEnvelope>(
  value: unknown,
  isEnvelope: (item: unknown) => item is TEnvelope,
): BatchFrame<TEnvelope> | null {
  if (typeof value !== 'object' || value === null) return null;
  const { batch, seq } = value as { batch?: unknown; seq?: unknown };
  if (!Array.isArray(batch) || typeof seq !== 'string' || !STREAM_ID_PATTERN.test(seq)) {
    return null;
  }
  if (!batch.every(isEnvelope)) return null;
  return { batch, seq };
}

export function createRealtimeFrameReader<TEnvelope>({
  onParseError,
  onResyncNeeded,
  parseBatch,
  resyncThrottleMs = DEFAULT_RESYNC_THROTTLE_MS,
}: FrameReaderOptions<TEnvelope>): RealtimeFrameReader<TEnvelope> {
  let lastSeq: string | null = null;
  let lastResyncAt = 0;

  function triggerResync(): void {
    const now = Date.now();
    if (now - lastResyncAt < resyncThrottleMs) return;
    lastResyncAt = now;
    onResyncNeeded();
  }

  return {
    getLastSeq: () => lastSeq,
    readFrame: (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (error) {
        onParseError(error);
        triggerResync();
        return null;
      }
      if (parsed && typeof parsed === 'object' && 'hb' in parsed) return null;

      const frame = parseBatch(parsed);
      if (!frame) {
        onParseError(new Error('Invalid realtime batch frame'));
        triggerResync();
        return null;
      }
      if (lastSeq && !isRealtimeSeqAfter(frame.seq, lastSeq)) return null;
      lastSeq = frame.seq;
      return frame.batch;
    },
    reportInvalidEvent: triggerResync,
    reset: () => {
      lastSeq = null;
    },
  };
}
