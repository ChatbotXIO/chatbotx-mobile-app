import type BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Sheet } from '@/components/ui/sheet';
import { Text } from '@/components/ui/text';
import type {
  BotCategoryFilter,
  ConversationChannelFilter,
  ConversationStatusFilter,
} from '@/features/conversations/stores/use-conversation-filters';
import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { useTheme } from '@/theme/use-theme';

/** All 9 channel enum values the backend accepts for this filter (see
 * `use-conversation-filters.ts`'s `ConversationChannelFilter`), plus a leading "all" — previously
 * truncated to the first 4 via `.slice(0, 4)`, silently hiding zalo/telegram/smtp/tiktok/
 * omnichannel from the filter sheet. Channel/platform brand names (Messenger, Instagram,
 * WhatsApp, Zalo, Telegram, TikTok) stay literal — they're proper nouns, not translatable UI
 * copy. "Webchat", "Email", and "Omnichannel" are ours. Rendered as a wrapping chip row rather
 * than `SegmentedTabs` — 10 options don't fit a single-row segmented control. */
const CHANNEL_OPTIONS: { value: ConversationChannelFilter | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'conversations.filterAll' },
  { value: 'omnichannel', labelKey: 'conversations.channelOmnichannel' },
  { value: 'messenger', labelKey: 'conversations.channelMessenger' },
  { value: 'instagram', labelKey: 'conversations.channelInstagram' },
  { value: 'whatsapp', labelKey: 'conversations.channelWhatsapp' },
  { value: 'webchat', labelKey: 'conversations.channelWebchat' },
  { value: 'zalo', labelKey: 'conversations.channelZalo' },
  { value: 'telegram', labelKey: 'conversations.channelTelegram' },
  { value: 'smtp', labelKey: 'conversations.channelEmail' },
  { value: 'tiktok', labelKey: 'conversations.channelTiktok' },
];

const STATUS_OPTIONS: { value: ConversationStatusFilter; labelKey: string }[] = [
  { value: 'unread', labelKey: 'conversations.statusUnread' },
  { value: 'noAdminReply', labelKey: 'conversations.statusNoAdminReply' },
  { value: 'followUp', labelKey: 'conversations.statusFollowUp' },
  { value: 'archived', labelKey: 'conversations.statusArchived' },
  { value: 'blocked', labelKey: 'conversations.statusBlocked' },
];

const BOT_CATEGORY_OPTIONS: { value: BotCategoryFilter; labelKey: string }[] = [
  { value: 'all', labelKey: 'conversations.filterAll' },
  { value: 'bot', labelKey: 'conversations.handledByBot' },
  { value: 'human', labelKey: 'conversations.handledByHuman' },
];

type BotEnabledOption = 'all' | 'on' | 'off';

const BOT_ENABLED_OPTIONS: { value: BotEnabledOption; labelKey: string }[] = [
  { value: 'all', labelKey: 'conversations.filterAll' },
  { value: 'on', labelKey: 'conversations.botOn' },
  { value: 'off', labelKey: 'conversations.botOff' },
];

interface FilterSheetProps {
  sheetRef: RefObject<BottomSheet | null>;
}

/** Filter sheet for the conversations list — form controls map 1:1 to the top-level fields
 * `listConversationsByPOSTAuthenticatedAPI` accepts (see use-conversation-filters.ts). The
 * advanced `contactFilter` condition-builder from that schema is not exposed here — it's a
 * large audience-builder DSL that belongs to a dedicated "advanced search" surface, not this
 * quick filter sheet (mirrors the legacy app's AdvancedSearchModal vs QuickFilter split). */
export function FilterSheet({ sheetRef }: FilterSheetProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const channel = useConversationFilters((state) => state.channel);
  const setChannel = useConversationFilters((state) => state.setChannel);
  const status = useConversationFilters((state) => state.status);
  const setStatus = useConversationFilters((state) => state.setStatus);
  const botCategory = useConversationFilters((state) => state.botCategory);
  const setBotCategory = useConversationFilters((state) => state.setBotCategory);
  const botEnabled = useConversationFilters((state) => state.botEnabled);
  const setBotEnabled = useConversationFilters((state) => state.setBotEnabled);
  const reset = useConversationFilters((state) => state.reset);

  function toggleStatus(value: ConversationStatusFilter) {
    const current = status ?? [];
    const next = current.includes(value) ? current.filter((s) => s !== value) : [...current, value];
    setStatus(next.length > 0 ? next : undefined);
  }

  const botEnabledValue: BotEnabledOption =
    botEnabled === true ? 'on' : botEnabled === false ? 'off' : 'all';

  function handleBotEnabledChange(value: BotEnabledOption) {
    setBotEnabled(value === 'all' ? undefined : value === 'on');
  }

  return (
    <Sheet ref={sheetRef} snapPoints={['60%', '90%']}>
      <BottomSheetScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Text variant="title">{t('conversations.filters')}</Text>

        <View style={styles.section}>
          <Text variant="caption" color="secondary">
            {t('conversations.channel')}
          </Text>
          <View style={styles.chipRow}>
            {CHANNEL_OPTIONS.map((option) => {
              const active = (channel ?? 'all') === option.value;
              return (
                <StatusChip
                  key={option.value}
                  label={t(option.labelKey)}
                  active={active}
                  onPress={() => setChannel(option.value === 'all' ? undefined : option.value)}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary">
            {t('conversations.handledBy')}
          </Text>
          <SegmentedTabs
            options={BOT_CATEGORY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            value={botCategory ?? 'all'}
            onChange={(value) => setBotCategory(value === 'all' ? undefined : value)}
          />
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary">
            {t('conversations.botOnOffLabel')}
          </Text>
          <SegmentedTabs
            options={BOT_ENABLED_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            value={botEnabledValue}
            onChange={handleBotEnabledChange}
          />
        </View>

        <View style={styles.section}>
          <Text variant="caption" color="secondary">
            {t('conversations.status')}
          </Text>
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((option) => {
              const active = (status ?? []).includes(option.value);
              return (
                <StatusChip
                  key={option.value}
                  label={t(option.labelKey)}
                  active={active}
                  onPress={() => toggleStatus(option.value)}
                />
              );
            })}
          </View>
        </View>

        <Button label={t('conversations.clearFilters')} variant="secondary" onPress={reset} />
        <Button
          label={t('common.done')}
          variant="primary"
          onPress={() => sheetRef.current?.close()}
        />
      </BottomSheetScrollView>
    </Sheet>
  );
}

function StatusChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statusChip,
        {
          backgroundColor: active ? colors.primary : colors.surface,
          borderRadius: radius.full,
          paddingHorizontal: spacing.ms,
        },
      ]}
    >
      <Text variant="caption" color={active ? 'inverse' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    paddingVertical: 6,
  },
});
