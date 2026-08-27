import { useQueryClient } from '@tanstack/react-query';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import { useConversationDetail } from '@/features/conversations/api/use-conversation-detail';
import { useDisableBot, useEnableBot } from '@/features/conversations/api/use-conversation-actions';
import { isBotActive } from '@/features/conversations/lib/conversation-status';
import { findConversationInListCache } from '@/features/conversations/lib/find-conversation-in-cache';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { ConversationActionsSheet } from './conversation-actions-sheet';

interface ChatHeaderProps {
  workspaceId: string;
  conversationId: string;
  onBack: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

/** Resolves conversation identity via `useConversationDetail`, seeded with a synchronous
 * `findConversationInListCache` placeholder — this is what fixes the "Conversation" fallback bug
 * on a deep link straight into a conversation: the header now always has SOME data to render,
 * either from the list cache the user navigated from, or (once it resolves) the dedicated detail
 * fetch, rather than only ever reading the list cache and falling back to a hardcoded string when
 * it's empty (e.g. cold deep link with no list query cached yet). */
export function ChatHeader({ workspaceId, conversationId, onBack, onLayout }: ChatHeaderProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const queryClient = useQueryClient();
  const actionsSheetRef = useRef<BottomSheet>(null);

  const { data: conversation } = useConversationDetail(workspaceId, conversationId, {
    placeholderData: () => findConversationInListCache(queryClient, workspaceId, conversationId),
  });

  const enableBot = useEnableBot(workspaceId);
  const disableBot = useDisableBot(workspaceId);

  const contactName = conversation?.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation?.contactInboxes?.[0]?.channel;
  const assigneeName = conversation?.assignedUser?.name;
  const botActive = conversation
    ? isBotActive(conversation.botEnabled, conversation.botResumeAt)
    : false;

  function handleToggleBot() {
    if (!conversation) return;
    if (botActive) {
      disableBot.mutate([conversationId]);
    } else {
      enableBot.mutate([conversationId]);
    }
  }

  const subtitleParts = [
    channel ? t(`conversations.channel${capitalize(channel)}`, { defaultValue: channel }) : null,
    assigneeName ? t('conversations.assignedTo', { name: assigneeName }) : null,
  ].filter(Boolean);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.container,
        {
          borderBottomColor: colors.borderSubtle,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          gap: spacing.xs,
        },
      ]}
    >
      <IconButton
        accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        icon="chevron-back"
        variant="ghost"
        onPress={onBack}
      />

      <Pressable
        style={styles.identity}
        accessibilityRole="button"
        onPress={() => router.push(`/(app)/conversations/${conversationId}/contact` as never)}
      >
        <Avatar
          uri={conversation?.contact?.avatar}
          name={contactName}
          size={36}
          ring={botActive ? 'bot' : 'none'}
          badge={channel ? <ChannelBadge channel={channel} size={12} /> : undefined}
        />
        <View style={styles.nameColumn}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {contactName}
          </Text>
          {subtitleParts.length > 0 ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {subtitleParts.join(' · ')}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <IconButton
        accessibilityLabel={
          botActive ? t('conversations.disableBot') : t('conversations.enableBot')
        }
        icon="sparkles"
        variant="tonal"
        tint={botActive ? colors.bubbleBotAccent : undefined}
        style={botActive ? { backgroundColor: withAlpha(colors.bubbleBotAccent, 0.16) } : undefined}
        haptic="medium"
        onPress={handleToggleBot}
      />

      <IconButton
        accessibilityLabel={t('conversations.actions')}
        icon="ellipsis-vertical"
        variant="ghost"
        onPress={() => actionsSheetRef.current?.expand()}
      />

      <ConversationActionsSheet
        ref={actionsSheetRef}
        workspaceId={workspaceId}
        conversationId={conversationId}
        conversation={conversation}
        onClose={() => actionsSheetRef.current?.close()}
      />
    </View>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  nameColumn: {
    gap: 2,
    flex: 1,
  },
});
