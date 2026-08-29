import { alphaTokens, darken, lighten, withAlpha } from '@/theme/color-utils';

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

describe('darken', () => {
  it('scales every channel toward black by the given amount', () => {
    expect(darken('#3c6df0', 0.2)).toBe('#3057c0');
  });

  it('returns the input unchanged at 0 and black at 1', () => {
    expect(darken('#3c6df0', 0)).toBe('#3c6df0');
    expect(darken('#3c6df0', 1)).toBe('#000000');
  });

  it('clamps out-of-range amounts', () => {
    expect(darken('#3c6df0', -1)).toBe('#3c6df0');
    expect(darken('#3c6df0', 5)).toBe('#000000');
  });

  it('always emits two hex digits per channel', () => {
    expect(darken('#0a0a0a', 0.5)).toBe('#050505');
  });

  it('throws on an invalid hex color', () => {
    expect(() => darken('#fff', 0.2)).toThrow(/darken/);
  });
});

describe('lighten', () => {
  it('blends every channel toward white by the given amount', () => {
    expect(lighten('#3c6df0', 0.5)).toBe('#9eb6f8');
  });

  it('returns the input unchanged at 0 and white at 1', () => {
    expect(lighten('#3c6df0', 0)).toBe('#3c6df0');
    expect(lighten('#3c6df0', 1)).toBe('#ffffff');
  });

  it('throws on an invalid hex color', () => {
    expect(() => lighten('blue', 0.2)).toThrow(/lighten/);
  });
});
