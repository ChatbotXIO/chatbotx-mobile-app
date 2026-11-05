/**
 * Resume-cursor helpers for the realtime stream, ported from the web realtime protocol package
 * (aha.chat commit 47c9c9c0f). A cursor is a Redis stream id, `<milliseconds>-<sequence>`.
 */
export const STREAM_ID_PATTERN = /^\d+-\d+$/;

/** Compares two non-negative integer strings without BigInt (digit-string compare is exact). */
function compareDigitStrings(a: string, b: string): number {
  const left = a.replace(/^0+(?=\d)/, '');
  const right = b.replace(/^0+(?=\d)/, '');
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * True when `candidate` is strictly newer than `previous`. Returns `false` — never throws — for
 * malformed ids so a non-numeric cursor can't crash comparison.
 */
export function isRealtimeSeqAfter(candidate: string, previous: string): boolean {
  if (!STREAM_ID_PATTERN.test(candidate) || !STREAM_ID_PATTERN.test(previous)) {
    return false;
  }
  const [candidateMs = '', candidateSeq = ''] = candidate.split('-');
  const [previousMs = '', previousSeq = ''] = previous.split('-');
  const msOrder = compareDigitStrings(candidateMs, previousMs);
  if (msOrder !== 0) return msOrder > 0;
  return compareDigitStrings(candidateSeq, previousSeq) > 0;
}
