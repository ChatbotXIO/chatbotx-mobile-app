import { generateClientId } from '@/features/chat/api/generate-client-id';

describe('generateClientId', () => {
  it('returns a numeric string', () => {
    expect(generateClientId()).toMatch(/^\d+$/);
  });

  it('generates mostly-unique values across repeated calls', () => {
    // Timestamp-prefixed + 3-digit random suffix: calls within the same millisecond only draw
    // from 1000 possible suffixes, so a tight synchronous loop can occasionally collide — this
    // is expected per the source's own collision-tolerance comment, not a bug to chase to zero.
    const ids = new Set(Array.from({ length: 50 }, () => generateClientId()));
    expect(ids.size).toBeGreaterThan(40);
  });
});
