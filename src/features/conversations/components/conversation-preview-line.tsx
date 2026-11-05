import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  describeConversationPreview,
  type ConversationPreview,
  type PreviewAttachmentType,
  type PreviewSender,
} from '@/features/conversations/lib/conversation-preview';
import type { BotState } from '@/features/conversations/lib/conversation-status';
import { useTheme } from '@/theme/use-theme';

const ATTACHMENT_ICONS: Record<PreviewAttachmentType, IconName> = {
  image: 'image',
  gif: 'image',
  video: 'video',
  audio: 'music',
  file: 'file',
};

interface ConversationPreviewLineProps {
  messages: Parameters<typeof describeConversationPreview>[0]['messages'];
  unread: boolean;
  botState: BotState;
}

/** Second line of a row: [bot glyph] [type icon] "You: text". Bot glyph shows only while the bot is
 * on (violet) or paused (clock) — the default human-only state stays quiet. */
export function ConversationPreviewLine({
  messages,
  unread,
  botState,
}: ConversationPreviewLineProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const preview = describeConversationPreview({ messages });
  const isFailed = preview.kind === 'failed';
  const textColor = isFailed ? 'danger' : unread ? 'primary' : 'secondary';

  return (
    <View style={styles.line}>
      {botState === 'on' ? <Icon name="bot" size={14} color={colors.bubbleBotAccent} /> : null}
      {botState === 'paused' ? <Icon name="clock" size={14} color={colors.textTertiary} /> : null}
      <PreviewIcon preview={preview} />
      <Text
        variant="callout"
        color={textColor}
        numberOfLines={1}
        style={[styles.text, unread && styles.unread, preview.kind === 'deleted' && styles.deleted]}
      >
        {previewText(preview, t)}
      </Text>
    </View>
  );
}

function PreviewIcon({ preview }: { preview: ConversationPreview }) {
  const { colors } = useTheme();
  if (preview.kind === 'failed')
    return <Icon name="circle-alert" size={14} color={colors.danger} />;
  if (preview.kind === 'attachment') {
    return (
      <Icon name={ATTACHMENT_ICONS[preview.attachmentType]} size={14} color={colors.textTertiary} />
    );
  }
  return null;
}

function prefixOf(sender: PreviewSender, t: (key: string) => string): string {
  if (sender === 'you') return `${t('conversations.preview.you')}: `;
  if (sender === 'bot') return `${t('conversations.preview.bot')}: `;
  return '';
}

export function previewText(preview: ConversationPreview, t: (key: string) => string): string {
  switch (preview.kind) {
    case 'empty':
      return '';
    case 'deleted':
      return t('conversations.preview.deleted');
    case 'failed':
      return t('conversations.preview.failed');
    case 'attachment':
      return `${prefixOf(preview.sender, t)}${t(`conversations.preview.${preview.attachmentType}`)}`;
    case 'text':
      return `${prefixOf(preview.sender, t)}${preview.text}`;
  }
}

const styles = StyleSheet.create({
  line: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    flex: 1,
  },
  unread: {
    fontWeight: '600',
  },
  deleted: {
    fontStyle: 'italic',
  },
});
