import { inboxNameOf } from './inbox-name';

describe('inboxNameOf', () => {
  it('returns the trimmed name', () => {
    expect(inboxNameOf({ inbox: { name: '  AhaChat ' } })).toBe('AhaChat');
  });

  it('returns null for a whitespace-only or empty name', () => {
    expect(inboxNameOf({ inbox: { name: '   ' } })).toBeNull();
    expect(inboxNameOf({ inbox: { name: '' } })).toBeNull();
  });

  it('returns null when the inbox or contact inbox is missing', () => {
    expect(inboxNameOf({ inbox: null })).toBeNull();
    expect(inboxNameOf({})).toBeNull();
    expect(inboxNameOf(undefined)).toBeNull();
  });
});
