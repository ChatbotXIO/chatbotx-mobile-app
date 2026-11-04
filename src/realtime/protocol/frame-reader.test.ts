import { createRealtimeFrameReader, parseBatchFrame } from './frame-reader';

type Envelope = { eventType: string };
const isEnvelope = (item: unknown): item is Envelope =>
  typeof item === 'object' && item !== null && typeof (item as Envelope).eventType === 'string';

function setup() {
  const onParseError = jest.fn();
  const onResyncNeeded = jest.fn();
  const reader = createRealtimeFrameReader<Envelope>({
    parseBatch: (value) => parseBatchFrame(value, isEnvelope),
    onParseError,
    onResyncNeeded,
    resyncThrottleMs: 1000,
  });
  return { reader, onParseError, onResyncNeeded };
}

const frame = (seq: string, ...types: string[]) =>
  JSON.stringify({ seq, batch: types.map((eventType) => ({ eventType })) });

describe('createRealtimeFrameReader', () => {
  it('returns the batch and advances the cursor', () => {
    const { reader } = setup();
    expect(reader.readFrame(frame('1-0', 'a', 'b'))).toEqual([
      { eventType: 'a' },
      { eventType: 'b' },
    ]);
    expect(reader.getLastSeq()).toBe('1-0');
  });

  it('drops a stale or duplicate seq', () => {
    const { reader } = setup();
    reader.readFrame(frame('2-0', 'a'));
    expect(reader.readFrame(frame('2-0', 'a'))).toBeNull();
    expect(reader.readFrame(frame('1-5', 'a'))).toBeNull();
    expect(reader.getLastSeq()).toBe('2-0');
  });

  it('ignores heartbeats without resyncing', () => {
    const { reader, onResyncNeeded } = setup();
    expect(reader.readFrame(JSON.stringify({ hb: 1 }))).toBeNull();
    expect(onResyncNeeded).not.toHaveBeenCalled();
  });

  it('requests a resync for malformed JSON and invalid frames, throttled', () => {
    const { reader, onParseError, onResyncNeeded } = setup();
    expect(reader.readFrame('{not json')).toBeNull();
    expect(reader.readFrame(JSON.stringify({ seq: 'x', batch: [] }))).toBeNull();
    expect(onParseError).toHaveBeenCalledTimes(2);
    expect(onResyncNeeded).toHaveBeenCalledTimes(1);
  });

  it('accepts a lower seq after reset', () => {
    const { reader } = setup();
    reader.readFrame(frame('9-0', 'a'));
    reader.reset();
    expect(reader.getLastSeq()).toBeNull();
    expect(reader.readFrame(frame('1-0', 'a'))).toEqual([{ eventType: 'a' }]);
  });
});
