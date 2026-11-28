import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { FlatList, Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  type ParsedTemplate,
  type TemplateButton,
  type TemplateCard,
} from '@/features/chat/lib/template-message';
import { useTheme } from '@/theme/use-theme';

const CARD_WIDTH = 220;
const CARD_IMAGE_HEIGHT = 120;

interface TemplateMessageViewProps {
  template: ParsedTemplate;
  outbound: boolean;
}

const BUTTON_ICONS: Record<TemplateButton['kind'], IconName> = {
  url: 'globe',
  phone: 'phone',
  'copy-code': 'paperclip',
  postback: 'message-circle',
};

export async function runTemplateButton(button: TemplateButton): Promise<void> {
  switch (button.kind) {
    case 'url':
      await WebBrowser.openBrowserAsync(button.url);
      return;
    case 'phone':
      await Linking.openURL(`tel:${button.phone}`);
      return;
    case 'copy-code':
      // No clipboard module is installed (it would need a native rebuild), so the system share
      // sheet — which offers "Copy" — is used to hand the code over.
      await Share.share({ message: button.code });
      return;
    case 'postback':
      return;
  }
}

function TemplateButtonRow({ button }: { button: TemplateButton }) {
  const { colors, spacing, radius } = useTheme();
  const isStatic = button.kind === 'postback';

  return (
    <Pressable
      accessibilityRole={isStatic ? 'text' : 'button'}
      accessibilityLabel={button.title}
      disabled={isStatic}
      onPress={() => void runTemplateButton(button).catch(() => undefined)}
      style={[
        styles.button,
        {
          borderColor: colors.borderSubtle,
          borderRadius: radius.md,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          gap: spacing.xs,
          opacity: isStatic ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={BUTTON_ICONS[button.kind]} size={14} color={colors.brand} />
      <Text variant="callout" style={{ color: colors.brand }} numberOfLines={2}>
        {button.title}
      </Text>
    </Pressable>
  );
}

function CardView({ card }: { card: TemplateCard }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.borderSubtle,
          borderRadius: radius.md,
          backgroundColor: colors.surface1,
        },
      ]}
    >
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ padding: spacing.sm, gap: spacing.xs }}>
        {card.title ? (
          <Text variant="bodyStrong" numberOfLines={2}>
            {card.title}
          </Text>
        ) : null}
        {card.subtitle ? (
          <Text variant="caption" color="secondary" numberOfLines={3}>
            {card.subtitle}
          </Text>
        ) : null}
        {card.buttons.map((button, index) => (
          <TemplateButtonRow key={`${button.title}-${index}`} button={button} />
        ))}
      </View>
    </View>
  );
}

/** Renders a button template (text + action buttons) or a horizontally scrolling carousel. */
export function TemplateMessageView({ template, outbound }: TemplateMessageViewProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  if (template.kind === 'carousel') {
    return (
      <FlatList
        horizontal
        data={template.cards}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item }) => <CardView card={item} />}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: spacing.xs }} />}
        accessibilityLabel={t('chat.templateCarousel')}
      />
    );
  }

  const textColor = outbound ? colors.bubbleOutText : colors.bubbleInText;
  return (
    <View style={{ gap: spacing.xs }}>
      {template.text ? (
        <Text variant="body" style={{ color: textColor }}>
          {template.text}
        </Text>
      ) : null}
      {template.buttons.map((button, index) => (
        <TemplateButtonRow key={`${button.title}-${index}`} button={button} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    width: CARD_WIDTH,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
