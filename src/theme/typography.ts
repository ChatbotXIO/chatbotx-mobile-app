/**
 * Display-family font resolution. Chrome text (headings, titles, labels — anything using the
 * `display`/`heading`/`title`/`subtitle` typography variants at weight 600/700) uses Plus Jakarta
 * Sans; body/user-generated content stays on the system font so CJK/Arabic/Hebrew glyphs never
 * mix a Latin-only webfont with a system CJK/RTL fallback mid-string.
 *
 * Fonts must be loaded via `useFonts` from `@expo-google-fonts/plus-jakarta-sans` (see
 * src/app/_layout.tsx) before this is used to render — `resolveDisplayFamily` only picks the
 * *name*, it doesn't load anything itself.
 */
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

/** Language prefixes (BCP-47 primary subtag) whose scripts should never be forced onto a
 * Latin-only display face — Arabic, Hebrew, Japanese, Chinese. Returns `undefined` for these so
 * callers fall back to the OS system font, which already ships full script coverage. */
const SYSTEM_FONT_LANGUAGE_PREFIXES = ['ar', 'he', 'ja', 'zh'] as const;

export type DisplayFontWeight = '600' | '700';

const DISPLAY_FONT_FAMILIES: Record<DisplayFontWeight, string> = {
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
};

/** Ensures the font-loading side effect above is retained (and the values are the actual
 * `useFonts` map keys) — never referenced directly, `useFonts({ PlusJakartaSans_600SemiBold, ...
 * })` in _layout.tsx uses the named imports instead. */
void PlusJakartaSans_600SemiBold;
void PlusJakartaSans_700Bold;

/**
 * Resolves the font-family name to use for display-weight chrome text in the given language.
 * Returns `undefined` (meaning: don't override `fontFamily`, let the system font render) for
 * languages whose scripts Plus Jakarta Sans doesn't cover well; otherwise returns the loaded
 * Plus Jakarta Sans family name for the given weight.
 */
export function resolveDisplayFamily(
  language: string,
  weight: DisplayFontWeight = '700',
): string | undefined {
  const primarySubtag = language.toLowerCase().split('-')[0];
  const isSystemFontLanguage = SYSTEM_FONT_LANGUAGE_PREFIXES.some(
    (prefix) => primarySubtag === prefix,
  );

  if (isSystemFontLanguage) return undefined;

  return DISPLAY_FONT_FAMILIES[weight];
}
