import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Channel enum values from `conversationsAPI.listConversationsByPOSTAuthenticatedAPI` (generated
 * schema.ts) — the single-channel filter field, not the per-conversation contactInbox channel. */
export type ConversationChannelFilter =
  | 'omnichannel'
  | 'webchat'
  | 'messenger'
  | 'whatsapp'
  | 'zalo'
  | 'smtp'
  | 'telegram'
  | 'instagram'
  | 'tiktok';

/** Status enum values — reused by the schema for both `status` and `tags` request fields. */
export type ConversationStatusFilter =
  'noAdminReply' | 'unread' | 'followUp' | 'archived' | 'blocked';

export type BotCategoryFilter = 'bot' | 'human' | 'all';

/** Persisted conversation-list filters, matching exactly the top-level fields
 * `listConversationsByPOSTAuthenticatedAPI` accepts (excluding `contactFilter`, `sort`, `cursor`,
 * `perPage` — those are pagination/advanced-audience concerns, not user-facing filters here). */
interface ConversationFiltersState {
  botCategory: BotCategoryFilter | undefined;
  assignedId: string | null | undefined;
  channel: ConversationChannelFilter | undefined;
  status: ConversationStatusFilter[] | undefined;
  keyword: string;
  botEnabled: boolean | null | undefined;
  setBotCategory: (value: BotCategoryFilter | undefined) => void;
  setAssignedId: (value: string | null | undefined) => void;
  setChannel: (value: ConversationChannelFilter | undefined) => void;
  setStatus: (value: ConversationStatusFilter[] | undefined) => void;
  setKeyword: (value: string) => void;
  setBotEnabled: (value: boolean | null | undefined) => void;
  reset: () => void;
}

const defaultFilters = {
  botCategory: undefined,
  assignedId: undefined,
  channel: undefined,
  status: undefined,
  keyword: '',
  botEnabled: undefined,
} as const;

export const useConversationFilters = create<ConversationFiltersState>()(
  persist(
    (set) => ({
      ...defaultFilters,
      setBotCategory: (botCategory) => set({ botCategory }),
      setAssignedId: (assignedId) => set({ assignedId }),
      setChannel: (channel) => set({ channel }),
      setStatus: (status) => set({ status }),
      setKeyword: (keyword) => set({ keyword }),
      setBotEnabled: (botEnabled) => set({ botEnabled }),
      reset: () => set(defaultFilters),
    }),
    {
      name: 'conversation-filters-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Plain-object snapshot of the active filters, safe to embed in a query key (persist's store API
 * carries functions too, which don't belong in a key). Returns a new object every call, so any
 * caller passing this straight to `useConversationFilters(...)` MUST wrap it in `useShallow` from
 * `zustand/react/shallow` — zustand v5's useSyncExternalStore has no shallow-equality fallback
 * (v4 did), so an unwrapped call re-renders on every render and trips React's infinite-loop guard. */
export function conversationFiltersSnapshot(state: ConversationFiltersState) {
  return {
    botCategory: state.botCategory,
    assignedId: state.assignedId,
    channel: state.channel,
    status: state.status,
    keyword: state.keyword,
    botEnabled: state.botEnabled,
  };
}
