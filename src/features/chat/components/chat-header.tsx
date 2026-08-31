import { useQueryClient } from '@tanstack/react-query';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { normalizeApiError } from '@/api/errors';
import { ChannelBadge } from '@/features/conversations/components/channel-badge';
import { useConversationDetail } from '@/features/conversations/api/use-conversation-detail';
import { useDisableBot, useEnableBot } from '@/features/conversations/api/use-conversation-actions';
import { botState, isBotActive } from '@/features/conversations/lib/conversation-status';
import { findConversationInListCache } from '@/features/conversations/lib/find-conversation-in-cache';
import type { FlowListItem } from '@/features/flows/api/use-flows';
import { useSendMessage } from '@/features/chat/api/use-send-message';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { withAlpha } from '@/theme/color-utils';
import { useTheme } from '@/theme/use-theme';

import { ConversationActionsSheet } from './conversation-actions-sheet';
import { FlowPickerSheet } from './flow-picker-sheet';
import { SavedRepliesSheet } from './saved-replies-sheet';

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
  const toast = useToast();
  const actionsSheetRef = useRef<BottomSheetModal>(null);
  const flowPickerRef = useRef<BottomSheetModal>(null);
  const savedRepliesRef = useRef<BottomSheetModal>(null);

  const { data: conversation } = useConversationDetail(workspaceId, conversationId, {
    placeholderData: () => findConversationInListCache(queryClient, workspaceId, conversationId),
  });

  const enableBot = useEnableBot(workspaceId);
  const disableBot = useDisableBot(workspaceId);
  const sendMessage = useSendMessage(workspaceId, conversationId);
  const setDraft = useChatStore((state) => state.setDraft);

  const contactName = conversation?.contact?.fullName ?? t('conversations.unknownContact');
  const channel = conversation?.contactInboxes?.[0]?.channel;
  const assigneeName = conversation?.assignedUser?.name;
  const botActive = conversation
    ? isBotActive(conversation.botEnabled, conversation.botResumeAt)
    : false;
  const botTriState = conversation
    ? botState(conversation.botEnabled, conversation.botResumeAt)
    : 'off';

  function handleToggleBot() {
    if (!conversation) return;
    if (botActive) {
      disableBot.mutate([conversationId]);
    } else {
      enableBot.mutate([conversationId]);
    }
  }

  async function handleSelectFlow(flow: FlowListItem) {
    flowPickerRef.current?.dismiss();
    toast({ message: t('chat.sendingFlow', { name: flow.name }), tone: 'info' });
    try {
      await sendMessage.mutateAsync({ workspaceId, conversationId, flowId: flow.id });
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.kind !== 'workspaceBlocked') {
        toast({ message: t('chat.flowSendFailed'), tone: 'danger' });
      }
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
        icon="chevron-left"
        variant="ghost"
        onPress={onBack}
      />

      <Pressable
        style={styles.identity}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(app)/conversations/[conversationId]/contact',
            params: { conversationId },
          })
        }
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
        icon={botTriState === 'on' ? 'bot' : botTriState === 'paused' ? 'clock' : 'bot-off'}
        variant="tonal"
        tint={
          botTriState === 'on'
            ? colors.bubbleBotAccent
            : botTriState === 'paused'
              ? colors.warning
              : undefined
        }
        style={
          botTriState === 'on'
            ? { backgroundColor: withAlpha(colors.bubbleBotAccent, 0.16) }
            : botTriState === 'paused'
              ? { backgroundColor: withAlpha(colors.warning, 0.16) }
              : undefined
        }
        haptic="medium"
        onPress={handleToggleBot}
      />

      <IconButton
        accessibilityLabel={t('conversations.actions')}
        icon="ellipsis-vertical"
        variant="ghost"
        onPress={() => actionsSheetRef.current?.present()}
      />

      <ConversationActionsSheet
        ref={actionsSheetRef}
        workspaceId={workspaceId}
        conversationId={conversationId}
        conversation={conversation}
        onClose={() => actionsSheetRef.current?.dismiss()}
        onSendFlow={() => flowPickerRef.current?.present()}
        onSavedReplies={() => savedRepliesRef.current?.present()}
      />

      <FlowPickerSheet
        ref={flowPickerRef}
        workspaceId={workspaceId}
        onSelect={handleSelectFlow}
        onClose={() => flowPickerRef.current?.dismiss()}
      />

      <SavedRepliesSheet
        ref={savedRepliesRef}
        workspaceId={workspaceId}
        onSelect={(text) => {
          setDraft(conversationId, text);
          savedRepliesRef.current?.dismiss();
        }}
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
