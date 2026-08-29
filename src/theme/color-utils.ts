/**
 * Color helpers for the token system. `withAlpha` replaces ad-hoc `${hex}1a`-style string
 * concatenation with a real alpha channel, so overlay/soft/scrim tokens can be derived from a
 * single base hex value instead of hand-picking a second hex per scheme.
 */

const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;

type Rgb = readonly [r: number, g: number, b: number];

/** Parses a 6-digit `#rrggbb` hex string into channel values. Throws on anything else (3-digit
 * shorthand, 8-digit hex-with-alpha, named colors) — callers only ever feed this our own token /
 * brand.json hex values, so a loud failure beats silently returning a wrong color. */
function parseHex(hex: string, caller: string): Rgb {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`${caller}: expected a 6-digit hex color like "#3c6df0", got "${hex}"`);
  }
  const intValue = parseInt(match[1], 16);
  return [(intValue >> 16) & 255, (intValue >> 8) & 255, intValue & 255];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const toHex = ([r, g, b]: Rgb): string =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** Linearly blends every channel of `hex` toward `target` (0 = unchanged, 1 = fully `target`). */
function mixToward(hex: string, target: number, amount: number, caller: string): string {
  const t = clamp01(amount);
  const blend = (channel: number): number => Math.round(channel + (target - channel) * t);
  const [r, g, b] = parseHex(hex, caller);
  return toHex([blend(r), blend(g), blend(b)]);
}

/** Returns an `rgba(r, g, b, alpha)` string for a 6-digit `#rrggbb` hex color. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex, 'withAlpha');
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
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

/** Darkens a 6-digit `#rrggbb` hex color toward black by `amount` (0–1). Used to derive the
 * light-scheme `brandStrong` (pressed/emphasis) shade from the single brand color in brand.json
 * instead of hand-picking a second hex per brand — see src/theme/tokens.ts. */
export function darken(hex: string, amount: number): string {
  return mixToward(hex, 0, amount, 'darken');
}

/** Lightens a 6-digit `#rrggbb` hex color toward white by `amount` (0–1). Used to derive the
 * dark-scheme brand shades (which need to sit on near-black surfaces) from the same brand color. */
export function lighten(hex: string, amount: number): string {
  return mixToward(hex, 255, amount, 'lighten');
}
