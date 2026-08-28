import { alphaTokens, withAlpha } from '@/theme/color-utils';

describe('withAlpha', () => {
  it('converts a 6-digit hex color into an rgba string', () => {
    expect(withAlpha('#3c6df0', 0.5)).toBe('rgba(60, 109, 240, 0.5)');
  });

  it('handles pure black and pure white', () => {
    expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
  });

  it('is case-insensitive on hex digits', () => {
    expect(withAlpha('#3C6DF0', 0.5)).toBe(withAlpha('#3c6df0', 0.5));
  });

  it('clamps alpha above 1 down to 1', () => {
    expect(withAlpha('#112233', 2)).toBe('rgba(17, 34, 51, 1)');
  });

  it('clamps alpha below 0 up to 0', () => {
    expect(withAlpha('#112233', -1)).toBe('rgba(17, 34, 51, 0)');
  });

  it('throws on a 3-digit shorthand hex', () => {
    expect(() => withAlpha('#fff', 0.5)).toThrow();
  });

  it('throws on an 8-digit hex-with-alpha string', () => {
    expect(() => withAlpha('#3c6df0ff', 0.5)).toThrow();
  });

  it('throws on a named color', () => {
    expect(() => withAlpha('blue', 0.5)).toThrow();
  });
});

describe('alphaTokens', () => {
  it('defines every documented alpha intent', () => {
    expect(alphaTokens).toEqual({
      hover: 0.06,
      pressed: 0.1,
      soft: 0.12,
      softDark: 0.18,
      disabled: 0.4,
      scrim: 0.4,
      scrimDark: 0.6,
    });
  });
});
