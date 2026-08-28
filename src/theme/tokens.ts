/**
 * Design tokens — single source of truth for color/spacing/radius/elevation/typography/motion.
 * See src/theme/use-theme.ts for the hook that resolves these against the active scheme, and
 * src/theme/navigation-theme.ts for the react-navigation adapter.
 *
 * Style direction: "Layered Workbench" — a tinted-neutral canvas with two raised surface levels,
 * hairline borders instead of heavy shadows, a strong type hierarchy, and color reserved for
 * meaning (channel identity, unread state, bot state, semantic status) rather than decoration.
 */

import { withAlpha } from './color-utils';

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const lightBase = {
  bg: '#f6f5f2',
  surface0: '#efeee9',
  surface1: '#ffffff',
  surface2: '#fbfaf8',
  borderSubtle: '#e5e2da',
  borderStrong: '#cfcabd',
  textPrimary: '#1c1b17',
  textSecondary: '#615c4f',
  // WCAG AA (4.5:1) against `bg` (#f6f5f2) requires darkening past the original #948d7c
  // (~3.0:1) — #767063 is the same warm-neutral hue, darkened just enough to clear 4.5:1
  // (measured ~4.51:1).
  textTertiary: '#767063',
  textInverse: '#ffffff',
  brand: '#3c6df0',
  brandStrong: '#2851c9',
  onBrand: '#ffffff',
  bubbleIn: '#ffffff',
  bubbleInText: '#1c1b17',
  bubbleOut: '#3c6df0',
  bubbleOutText: '#ffffff',
  bubbleBot: '#f1ecff',
  bubbleBotText: '#2f1f66',
  bubbleBotAccent: '#7c4dff',
  success: '#12855a',
  warning: '#b4650a',
  danger: '#d92d20',
  info: '#2464c9',
} as const;

const darkBase = {
  bg: '#131210',
  surface0: '#1b1a17',
  surface1: '#211f1b',
  surface2: '#28261f',
  borderSubtle: '#332f27',
  borderStrong: '#4a4536',
  textPrimary: '#f4f2ec',
  textSecondary: '#b9b3a2',
  textTertiary: '#847d6b',
  textInverse: '#1c1b17',
  brand: '#7d9eff',
  brandStrong: '#a4bcff',
  onBrand: '#0e152b',
  bubbleIn: '#28261f',
  bubbleInText: '#f4f2ec',
  bubbleOut: '#3c5fd9',
  bubbleOutText: '#ffffff',
  bubbleBot: '#2a2145',
  bubbleBotText: '#e4d9ff',
  bubbleBotAccent: '#a184ff',
  success: '#4fd39a',
  warning: '#f2a93c',
  danger: '#f97066',
  info: '#7db2ff',
} as const;

/** 11-key channel identity map — every contactInbox `channel` value the backend can send. `smtp`
 * aliases `email`'s color (same medium, different transport), `webchat` aliases `brand` (it *is*
 * our own product surface, so it borrows the brand color rather than getting an arbitrary one). */
const lightChannel = {
  messenger: '#0866ff',
  instagram: '#e1306c',
  whatsapp: '#25d366',
  webchat: lightBase.brand,
  email: '#6b6355',
  smtp: '#6b6355',
  sms: '#12855a',
  zalo: '#0068ff',
  telegram: '#26a5e4',
  tiktok: '#010101',
  omnichannel: '#7c4dff',
} as const;

const darkChannel = {
  messenger: '#4a9eff',
  instagram: '#f472a3',
  whatsapp: '#4ade80',
  webchat: darkBase.brand,
  email: '#b9b3a2',
  smtp: '#b9b3a2',
  sms: '#4fd39a',
  zalo: '#5c9dff',
  telegram: '#6fc3ef',
  tiktok: '#f4f2ec',
  omnichannel: '#a184ff',
} as const;

/** Deterministic pastel fills for avatar-fallback tinting (initials on a color picked by hashing
 * the contact id/name — see avatar.tsx) — same 6 hues in both schemes, just retuned
 * for contrast against each canvas. */
const lightAvatarPalette = [
  '#ffd6d1', // coral
  '#ffe8b8', // amber
  '#d7f0d0', // sage
  '#c9ecec', // teal
  '#cfe0ff', // periwinkle
  '#ead6ff', // lilac
] as const;

const darkAvatarPalette = [
  '#5c2e29', // coral
  '#5c4a1f', // amber
  '#2c4a26', // sage
  '#204a4a', // teal
  '#26355c', // periwinkle
  '#43285c', // lilac
] as const;

type ColorBase = Record<keyof typeof lightBase, string>;
type ChannelMap = Record<keyof typeof lightChannel, string>;

function buildColorTokens(base: ColorBase, channel: ChannelMap, avatarPalette: readonly string[]) {
  return {
    ...base,
    brandSoft: withAlpha(base.brand, 0.14),
    successSoft: withAlpha(base.success, 0.14),
    warningSoft: withAlpha(base.warning, 0.14),
    dangerSoft: withAlpha(base.danger, 0.14),
    infoSoft: withAlpha(base.info, 0.14),
    scrim: withAlpha('#000000', 0.5),
    channel,
    avatarPalette,
  };
}

export const colorTokens = {
  light: buildColorTokens(lightBase, lightChannel, lightAvatarPalette),
  dark: buildColorTokens(darkBase, darkChannel, darkAvatarPalette),
} as const;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacingTokens = {
  xxs: 2,
  xs: 4,
  sm: 8,
  ms: 10,
  base: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

/**
 * NOTE on the `sm/md/lg/full` rename: the old scale was `sm:4, md:8, lg:16, full:999`. Existing
 * callers using `radius.sm + 2` (segmented-tabs pill, badge padding-adjacent math) or bare
 * `radius.md`/`radius.sm` (message bubbles, buttons, inputs, search bar) all read reasonably
 * with the new, slightly larger values below — nothing goes from a hairline radius to a full
 * pill or vice versa. `radius.full` is unchanged. See report for the full grep audit.
 */
export const radiusTokens = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  bubble: 18,
  full: 999,
} as const;

// ---------------------------------------------------------------------------
// Elevation
// ---------------------------------------------------------------------------

interface ElevationToken {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

function buildElevationTokens(shadowColor: string, opacityMultiplier: number) {
  const levels: readonly [number, number, number][] = [
    [0, 0, 0], // 0 — flush with the canvas, no shadow
    [0.06, 3, 1], // 1 — subtle lift (rows, chips)
    [0.1, 8, 2], // 2 — floating surfaces (cards, sheets at rest)
    [0.16, 16, 4], // 3 — overlays (modals, active sheets)
  ];

  return levels.map(([opacity, shadowRadius, elevation]): ElevationToken => ({
    shadowColor,
    shadowOpacity: opacity * opacityMultiplier,
    shadowRadius,
    shadowOffset: { width: 0, height: elevation > 0 ? Math.ceil(elevation / 2) : 0 },
    elevation,
  })) as [ElevationToken, ElevationToken, ElevationToken, ElevationToken];
}

export const elevationTokens = {
  light: buildElevationTokens('#1c1b17', 1),
  // Dark surfaces already sit on a dark canvas, so shadows read as noise unless softened —
  // halve the opacity relative to light.
  dark: buildElevationTokens('#000000', 0.5),
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

interface TypographyToken {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  maxFontSizeMultiplier: number;
  textTransform?: 'uppercase';
  letterSpacing?: number;
  fontVariant?: readonly ['tabular-nums'];
}

/**
 * NOTE on `heading`: the old spec was 28/34/700. The new redesign spec sizes `heading` at
 * 24/30/700 (one step down, `display` now owns the 32/38/700 slot old `heading` was closest to).
 * Any screen currently relying on `heading` for a large page title will render ~4pt smaller —
 * intentional per the new hierarchy (display > heading), flagged in the report rather than
 * silently left as a surprise.
 */
export const typographyTokens = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700', maxFontSizeMultiplier: 1.3 },
  heading: { fontSize: 24, lineHeight: 30, fontWeight: '700', maxFontSizeMultiplier: 1.3 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600', maxFontSizeMultiplier: 1.4 },
  subtitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', maxFontSizeMultiplier: 1.4 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400', maxFontSizeMultiplier: 1.6 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600', maxFontSizeMultiplier: 1.6 },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400', maxFontSizeMultiplier: 1.6 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400', maxFontSizeMultiplier: 1.6 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    maxFontSizeMultiplier: 1.6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    maxFontSizeMultiplier: 1.6,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TypographyToken>;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export const motionDurations = {
  instant: 80,
  fast: 120,
  base: 200,
  slow: 320,
  enter: 240,
  exit: 160,
} as const;

export const pressScale = 0.97;
