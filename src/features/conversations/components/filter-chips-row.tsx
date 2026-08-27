import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { useConversationFilters } from '@/features/conversations/stores/use-conversation-filters';
import { useAuthStore } from '@/stores/use-auth-store';
import { useTheme } from '@/theme/use-theme';

/**
 * Quick-filter chip: All / Unread / Mine / Bot / Following. These are single-select shortcuts
 * layered on top of the same store the full filter sheet reads (`use-conversation-filters.ts`) —
 * there's no separate "quick filter" concept on the backend, so each chip just sets the store
 * fields that already exist:
 *  - Unread  → `status: ['unread']` (a real server-side status filter)
 *  - Following → `status: ['followUp']` (ditto)
 *  - Mine    → `assignedId: currentUserId` (ditto)
 *  - Bot     → `botCategory: 'bot'` (ditto)
 *  - All     → clears all four quick-filter dimensions (channel/keyword from the sheet/search bar
 *    are left untouched — "All" only resets the facets this row itself can set).
 *
 * Only one quick filter is active at a time (chips are mutually exclusive here, matching the
 * "quick shortcut" mental model) — picking a second chip replaces whichever one was active,
 * rather than combining them. The full filter sheet still supports combining `status` values
 * freely; this row is intentionally simpler.
 */
type QuickFilter = 'all' | 'unread' | 'mine' | 'bot' | 'following';

export function FilterChipsRow() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const status = useConversationFilters((state) => state.status);
  const assignedId = useConversationFilters((state) => state.assignedId);
  const botCategory = useConversationFilters((state) => state.botCategory);
  const setStatus = useConversationFilters((state) => state.setStatus);
  const setAssignedId = useConversationFilters((state) => state.setAssignedId);
  const setBotCategory = useConversationFilters((state) => state.setBotCategory);

  const active: QuickFilter = (() => {
    if (status?.includes('unread')) return 'unread';
    if (status?.includes('followUp')) return 'following';
    if (botCategory === 'bot') return 'bot';
    if (currentUserId && assignedId === currentUserId) return 'mine';
    return 'all';
  })();

  function selectQuickFilter(next: QuickFilter) {
    // Clear the other quick-filter dimensions first so only one is ever active.
    setStatus(undefined);
    setAssignedId(undefined);
    setBotCategory(undefined);

    switch (next) {
      case 'unread':
        setStatus(['unread']);
        return;
      case 'following':
        setStatus(['followUp']);
        return;
      case 'bot':
        setBotCategory('bot');
        return;
      case 'mine':
        if (currentUserId) setAssignedId(currentUserId);
        return;
      case 'all':
        return;
    }
  }

  const chips: { value: QuickFilter; label: string }[] = [
    { value: 'all', label: t('conversations.filterAll') },
    { value: 'unread', label: t('conversations.statusUnread') },
    { value: 'mine', label: t('conversations.quickFilterMine') },
    { value: 'bot', label: t('conversations.handledByBot') },
    { value: 'following', label: t('conversations.statusFollowUp') },
  ];

  return (
    <ScrollView
      testID="filter-chips-row"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={[
        styles.row,
        { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
      ]}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.value}
          label={chip.label}
          selected={active === chip.value}
          tone="brand"
          onPress={() => selectQuickFilter(chip.value)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ScrollView's base style is `flexGrow: 1`; in the Inbox flex column that made this row split the
  // remaining height 50/50 with the conversation FlashList. Hug the chips' own height instead.
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
