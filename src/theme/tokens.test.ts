import { colorTokens, radiusTokens, spacingTokens, typographyTokens } from '@/theme/tokens';

const NEW_SEMANTIC_COLOR_KEYS = [
  'bg',
  'surface0',
  'surface1',
  'surface2',
  'borderSubtle',
  'borderStrong',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'textInverse',
  'brand',
  'brandStrong',
  'brandSoft',
  'onBrand',
  'bubbleIn',
  'bubbleInText',
  'bubbleOut',
  'bubbleOutText',
  'bubbleBot',
  'bubbleBotText',
  'bubbleBotAccent',
  'success',
  'successSoft',
  'warning',
  'warningSoft',
  'danger',
  'dangerSoft',
  'info',
  'infoSoft',
  'scrim',
] as const;

// Phase 7 removed `unreadDot`, `bubbleOutbound(Text)`, `bubbleInbound(Text)`; a later cleanup
// removed the remaining flat-key aliases (`background`, `surface`, `surfaceElevated`, `border`,
// `text`, `primary`, `primaryForeground`) once every call site migrated to the semantic keys
// above — see tokens.ts's doc comment.
const CHANNEL_KEYS = [
  'messenger',
  'instagram',
  'whatsapp',
  'webchat',
  'email',
  'smtp',
  'sms',
  'zalo',
  'telegram',
  'tiktok',
  'omnichannel',
] as const;

describe('colorTokens', () => {
  it.each(['light', 'dark'] as const)('defines every new semantic key for %s', (scheme) => {
    for (const key of NEW_SEMANTIC_COLOR_KEYS) {
      expect(colorTokens[scheme]).toHaveProperty(key);
      expect(typeof colorTokens[scheme][key]).toBe('string');
    }
  });

  it.each(['light', 'dark'] as const)('defines exactly the 11 channel keys for %s', (scheme) => {
    expect(Object.keys(colorTokens[scheme].channel).sort()).toEqual([...CHANNEL_KEYS].sort());
  });

  it('aliases smtp to email and webchat to brand in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(colorTokens[scheme].channel.smtp).toBe(colorTokens[scheme].channel.email);
      expect(colorTokens[scheme].channel.webchat).toBe(colorTokens[scheme].brand);
    }
  });

  it.each(['light', 'dark'] as const)('defines a 6-color avatar palette for %s', (scheme) => {
    expect(colorTokens[scheme].avatarPalette).toHaveLength(6);
  });

  it.each(['light', 'dark'] as const)(
    'no longer exposes any deprecated flat-key alias for %s',
    (scheme) => {
      const tokens = colorTokens[scheme] as Record<string, unknown>;
      // Phase 7 removals:
      expect(tokens.unreadDot).toBeUndefined();
      expect(tokens.bubbleOutbound).toBeUndefined();
      expect(tokens.bubbleOutboundText).toBeUndefined();
      expect(tokens.bubbleInbound).toBeUndefined();
      expect(tokens.bubbleInboundText).toBeUndefined();
      // Later cleanup removed the rest once every call site migrated to the semantic keys above:
      expect(tokens.background).toBeUndefined();
      expect(tokens.surface).toBeUndefined();
      expect(tokens.surfaceElevated).toBeUndefined();
      expect(tokens.border).toBeUndefined();
      expect(tokens.text).toBeUndefined();
      expect(tokens.primary).toBeUndefined();
      expect(tokens.primaryForeground).toBeUndefined();
    },
  );
});

describe('spacingTokens', () => {
  it('defines the full spacing scale', () => {
    expect(spacingTokens).toEqual({
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
    });
  });
});

describe('radiusTokens', () => {
  it('defines the full radius scale', () => {
    expect(radiusTokens).toEqual({
      xs: 6,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      bubble: 18,
      full: 999,
    });
  });
});

describe('typographyTokens', () => {
  it('defines every variant with a maxFontSizeMultiplier', () => {
    const variants = [
      'display',
      'heading',
      'title',
      'subtitle',
      'body',
      'bodyStrong',
      'callout',
      'caption',
      'label',
      'micro',
    ] as const;

    for (const variant of variants) {
      expect(typographyTokens[variant].maxFontSizeMultiplier).toBeGreaterThan(1);
    }
  });

  it('sizes display largest and micro smallest', () => {
    expect(typographyTokens.display.fontSize).toBeGreaterThan(typographyTokens.heading.fontSize);
    expect(typographyTokens.micro.fontSize).toBeLessThan(typographyTokens.caption.fontSize);
  });

  it('marks label as uppercase with letter spacing', () => {
    expect(typographyTokens.label.textTransform).toBe('uppercase');
    expect(typographyTokens.label.letterSpacing).toBeGreaterThan(0);
  });
});
