/**
 * Color helpers for the token system. `withAlpha` replaces ad-hoc `${hex}1a`-style string
 * concatenation with a real alpha channel, so overlay/soft/scrim tokens can be derived from a
 * single base hex value instead of hand-picking a second hex per scheme.
 */

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

/** Parses a 6-digit `#rrggbb` hex string and returns an `rgba(r, g, b, alpha)` string. Throws on
 * anything else (3-digit shorthand, 8-digit hex-with-alpha, named colors) — callers only ever
 * feed this our own token hex values, so a loud failure beats silently returning a wrong color. */
export function withAlpha(hex: string, alpha: number): string {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`withAlpha: expected a 6-digit hex color like "#3c6df0", got "${hex}"`);
  }

  const intValue = parseInt(match[1], 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  const clampedAlpha = Math.min(1, Math.max(0, alpha));

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

/** Shared alpha values for overlay-style states (hover/press/soft fills/scrims), so call sites
 * pick a named intent instead of a magic decimal. */
export const alphaTokens = {
  hover: 0.06,
  pressed: 0.1,
  soft: 0.12,
  softDark: 0.18,
  disabled: 0.4,
  scrim: 0.4,
  scrimDark: 0.6,
} as const;
