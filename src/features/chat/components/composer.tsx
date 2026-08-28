import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  NativeSyntheticEvent,
  StyleProp,
  TextInputContentSizeChangeEventData,
  ViewStyle,
} from 'react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { normalizeApiError } from '@/api/errors';
import { FEATURES } from '@/config/features';
import { useConversationDetail } from '@/features/conversations/api/use-conversation-detail';
import type { FlowListItem } from '@/features/flows/api/use-flows';
import { useEditMessage } from '@/features/chat/api/use-message-actions';
import { MAX_FILE_SIZE_BYTES, useSendMessage } from '@/features/chat/api/use-send-message';
import {
  partitionBySize,
  pickDocuments,
  pickFromLibrary,
} from '@/features/chat/lib/pick-attachments';
import { useChatStore } from '@/features/chat/stores/use-chat-store';
import { SequencePickerSheet } from '@/features/sequences/components/sequence-picker-sheet';
import { triggerHaptic } from '@/lib/haptics';
import { useTheme } from '@/theme/use-theme';

import { ComposerActionsSheet } from './composer-actions-sheet';
import { FlowPickerSheet } from './flow-picker-sheet';
import { QuotaBanner } from './quota-banner';
import { SavedRepliesSheet } from './saved-replies-sheet';

interface ComposerProps {
  workspaceId: string;
  conversationId: string;
  /** Extra style applied to the outermost container — the chat screen uses this to add
   * `paddingBottom: insets.bottom` only while the keyboard is closed (open keyboard already
   * pushes the composer up against it, so double-padding would leave a visible gap). */
  style?: StyleProp<ViewStyle>;
}

const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 132;

/** Text composer: attachment/flow/saved-reply picking via the `[+]` actions sheet, edit/reply
 * mode bar, auto-grow input, morphing send button, and the quota-banner gate on 402
 * workspaceBlocked. Failed-send retry lives on the message bubble itself (tap a failed bubble) —
 * the composer only starts NEW sends and edits. */
export function Composer({ workspaceId, conversationId, style }: ComposerProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius, scheme } = useTheme();
  const toast = useToast();

  const draft = useChatStore((state) => state.draftsByConversation[conversationId] ?? '');
  const setDraft = useChatStore((state) => state.setDraft);
  const composerMode = useChatStore((state) => state.composerModeByConversation[conversationId]);
  const setComposerMode = useChatStore((state) => state.setComposerMode);

  const sendMessage = useSendMessage(workspaceId, conversationId);
  const editMessage = useEditMessage(workspaceId, conversationId);

  const actionsSheetRef = useRef<BottomSheet>(null);
  const savedRepliesRef = useRef<BottomSheet>(null);
  const flowPickerRef = useRef<BottomSheet>(null);
  const sequencePickerRef = useRef<BottomSheet>(null);

  // `FEATURES.sendSequence` is off until the backend route ships (see src/config/features.ts) —
  // fetching the conversation detail here just to resolve `contactId` would be wasted work while
  // the entry is hidden, so this only fires the query once the flag is on. `useConversationDetail`
  // itself already no-ops via `enabled` when either id is missing.
  const { data: conversationForSequence } = useConversationDetail(
    FEATURES.sendSequence ? workspaceId : null,
    FEATURES.sendSequence ? conversationId : null,
  );

  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [quotaBlocked, setQuotaBlocked] = useState<Extract<
    ReturnType<typeof normalizeApiError>,
    { kind: 'workspaceBlocked' }
  > | null>(null);

  const sendButtonScale = useSharedValue(1);
  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const hasContent = draft.trim().length > 0;
  const isEditing = composerMode?.type === 'edit';
  const isReplying = composerMode?.type === 'reply';

  function handleChangeText(text: string) {
    setDraft(conversationId, text);
  }

  function handleContentSizeChange(
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) {
    const nextHeight = Math.min(
      MAX_INPUT_HEIGHT,
      Math.max(MIN_INPUT_HEIGHT, event.nativeEvent.contentSize.height),
    );
    setInputHeight(nextHeight);
  }

  function dismissComposerMode() {
    setComposerMode(conversationId, undefined);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || quotaBlocked) return;

    // reanimated `SharedValue.value` is a mutable UI-thread ref by design (not React state); the
    // react-compiler lint rule can't tell it apart from a plain object — see the matching comment
    // in pressable-scale.tsx.
    // eslint-disable-next-line react-hooks/immutability
    sendButtonScale.value = withTiming(0.85, { duration: 80 }, () => {
      sendButtonScale.value = withTiming(1, { duration: 120 });
    });
    triggerHaptic('light');

    if (isEditing && composerMode) {
      setDraft(conversationId, '');
      dismissComposerMode();
      editMessage.mutate({
        messageId: composerMode.message.id,
        createdAt: composerMode.message.createdAt,
        newText: text,
      });
      return;
    }

    const replyTo =
      isReplying && composerMode
        ? {
            messageId: composerMode.message.id,
            createdAt: composerMode.message.createdAt,
          }
        : undefined;

    setDraft(conversationId, '');
    dismissComposerMode();
    try {
      await sendMessage.mutateAsync({ workspaceId, conversationId, text, replyTo });
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.kind === 'workspaceBlocked') {
        setQuotaBlocked(normalized);
      }
      // Other failures already surface on the pending bubble itself (see use-send-message.ts
      // onError) — no need to re-show them here.
    }
  }

  async function sendAssets(
    assets: { uri: string; mimeType: string; fileName: string; size?: number }[],
  ) {
    setAttachmentError(null);
    const { ok, tooLarge } = partitionBySize(assets, MAX_FILE_SIZE_BYTES);

    if (tooLarge.length > 0) {
      setAttachmentError(
        t('chat.attachmentsTooLarge', {
          count: tooLarge.length,
          names: tooLarge.map((asset) => asset.fileName).join(', '),
        }),
      );
    }
    if (ok.length === 0) return;

    try {
      await sendMessage.mutateAsync({
        workspaceId,
        conversationId,
        attachments: ok.map((asset) => ({
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        })),
      });
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.kind === 'workspaceBlocked') {
        setQuotaBlocked(normalized);
      }
    }
  }

  function handleCamera() {
    actionsSheetRef.current?.close();
    router.push({ pathname: '/camera', params: { conversationId } });
  }

  async function handlePhotoLibrary() {
    actionsSheetRef.current?.close();
    const assets = await pickFromLibrary();
    if (assets.length === 0) return;
    await sendAssets(assets);
  }

  async function handleDocument() {
    actionsSheetRef.current?.close();
    const assets = await pickDocuments();
    if (assets.length === 0) return;
    await sendAssets(assets);
  }

  function handleOpenFlowPicker() {
    actionsSheetRef.current?.close();
    flowPickerRef.current?.expand();
  }

  function handleOpenSendSequence() {
    actionsSheetRef.current?.close();
    sequencePickerRef.current?.expand();
  }

  async function handleSelectFlow(flow: FlowListItem) {
    flowPickerRef.current?.close();
    toast({ message: t('chat.sendingFlow', { name: flow.name }), tone: 'info' });
    try {
      await sendMessage.mutateAsync({ workspaceId, conversationId, flowId: flow.id });
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (normalized.kind === 'workspaceBlocked') {
        setQuotaBlocked(normalized);
      } else {
        toast({ message: t('chat.flowSendFailed'), tone: 'danger' });
      }
    }
  }

  function handleOpenSavedReplies() {
    actionsSheetRef.current?.close();
    savedRepliesRef.current?.expand();
  }

  const modeBarLabel = isEditing
    ? t('chat.editingMessage')
    : isReplying && composerMode
      ? t('chat.replyingTo', {
          name:
            composerMode.message.senderType === 'contact'
              ? t('chat.senderContact')
              : t('chat.senderAgent'),
        })
      : null;
  const modeBarPreview =
    composerMode?.message.text ?? (composerMode ? t('chat.repliedAttachment') : null);

  return (
    <View style={style}>
      {quotaBlocked ? (
        <QuotaBanner error={quotaBlocked} onDismiss={() => setQuotaBlocked(null)} />
      ) : null}
      {attachmentError ? (
        <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs }}>
          <ErrorBanner message={attachmentError} tone="danger" />
        </View>
      ) : null}

      {modeBarLabel ? (
        <View
          style={[
            styles.modeBar,
            {
              backgroundColor: colors.surface0,
              paddingHorizontal: spacing.ms,
              paddingVertical: spacing.xs,
              gap: spacing.xxs,
            },
          ]}
        >
          <Icon
            name={isEditing ? 'create-outline' : 'arrow-undo-outline'}
            size={16}
            color={colors.brand}
          />
          <View style={styles.modeBarBody}>
            <Text variant="caption" style={{ color: colors.brand, fontWeight: '700' }}>
              {modeBarLabel}
            </Text>
            {modeBarPreview ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {modeBarPreview}
              </Text>
            ) : null}
          </View>
          <IconButton
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
            icon="close"
            size="sm"
            variant="ghost"
            onPress={dismissComposerMode}
          />
        </View>
      ) : null}

      <View
        style={[
          styles.row,
          { padding: spacing.sm, gap: spacing.xs, borderTopColor: colors.borderSubtle },
        ]}
      >
        <IconButton
          accessibilityLabel={t('chat.attach')}
          icon="add-circle"
          size="lg"
          variant="ghost"
          onPress={() => actionsSheetRef.current?.expand()}
          disabled={Boolean(quotaBlocked)}
        />

        <TextInput
          value={draft}
          onChangeText={handleChangeText}
          onContentSizeChange={handleContentSizeChange}
          placeholder={t('chat.typeAMessage')}
          placeholderTextColor={colors.textSecondary}
          keyboardAppearance={scheme}
          multiline
          editable={!quotaBlocked}
          style={[
            styles.input,
            {
              height: inputHeight,
              backgroundColor: colors.surface0,
              borderRadius: radius.md,
              color: colors.textPrimary,
              paddingHorizontal: spacing.sm,
            },
          ]}
        />

        <Animated.View style={sendButtonStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
            onPress={handleSend}
            disabled={!hasContent || Boolean(quotaBlocked)}
            style={[
              styles.sendButton,
              {
                backgroundColor: hasContent ? colors.brand : colors.surface0,
                borderRadius: radius.full,
              },
              (!hasContent || quotaBlocked) && styles.sendButtonDisabled,
            ]}
          >
            <Icon
              name={isEditing ? 'checkmark' : 'send'}
              size={18}
              color={hasContent ? colors.onBrand : colors.textTertiary}
              flipRTL={!isEditing}
            />
          </Pressable>
        </Animated.View>
      </View>

      <ComposerActionsSheet
        ref={actionsSheetRef}
        onClose={() => actionsSheetRef.current?.close()}
        onCamera={handleCamera}
        onPhotoLibrary={handlePhotoLibrary}
        onDocument={handleDocument}
        onSendFlow={handleOpenFlowPicker}
        onSavedReplies={handleOpenSavedReplies}
        // The sequences feature (src/features/sequences/**) now exists — landed in a parallel
        // workstream. `onSendSequence` is still omitted entirely (not shown disabled) unless the
        // contactId for this conversation has resolved, matching the "omit rather than disable"
        // convention this sheet already follows elsewhere. The picker sheet itself handles the
        // FEATURES.sendSequence-off "Coming soon" state, so this stays wired even while the flag
        // is off — flipping the flag in src/config/features.ts is the only thing left to do once
        // the backend route ships.
        onSendSequence={conversationForSequence?.contactId ? handleOpenSendSequence : undefined}
      />

      <FlowPickerSheet
        ref={flowPickerRef}
        workspaceId={workspaceId}
        onSelect={handleSelectFlow}
        onClose={() => flowPickerRef.current?.close()}
      />

      <SavedRepliesSheet
        ref={savedRepliesRef}
        workspaceId={workspaceId}
        onSelect={(text) => {
          setDraft(conversationId, text);
          savedRepliesRef.current?.close();
        }}
      />

      {conversationForSequence?.contactId ? (
        <SequencePickerSheet
          sheetRef={sequencePickerRef}
          workspaceId={workspaceId}
          contactId={conversationForSequence.contactId}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeBarBody: {
    flex: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
