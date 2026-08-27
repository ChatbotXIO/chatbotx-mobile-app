import { create } from 'zustand';

import type { Message } from '@/features/chat/api/use-messages-infinite';

export type ComposerMode = { type: 'edit'; message: Message } | { type: 'reply'; message: Message };

interface ChatStoreState {
  /** conversationId -> is the other side typing (set by realtime; use-realtime-handlers.ts pairs
   * every `setTyping(id, true, seconds)` with a typing-timers.ts expiry so this never sticks
   * forever if an explicit `typing: false` follow-up is dropped — see plan Phase 6). */
  typingByConversation: Record<string, boolean>;
  /** conversationId -> in-progress composer draft text, so switching away and back preserves it. */
  draftsByConversation: Record<string, string>;
  /** conversationId -> the composer's current edit/reply mode, if any. Cleared on send/cancel. */
  composerModeByConversation: Record<string, ComposerMode | undefined>;
  /** clientId -> upload progress ratio (0-1) for an in-flight multipart send. Set by the
   * `onProgress` callback threaded through send-message-multipart.ts, cleared when the mutation
   * settles (success or error) — see use-send-message.ts. */
  uploadProgressByClientId: Record<string, number>;
  /** The conversationId currently focused/visible on screen, or `null` when no chat screen is
   * focused. Set/cleared by the chat screen's `useFocusEffect` (see
   * `(app)/conversations/[conversationId]/index.tsx`); read via `useChatStore.getState()` from
   * `src/lib/notifications.ts`'s notification handler (outside React) to suppress the in-app
   * banner for a push notification about the conversation the user is already looking at. */
  activeConversationId: string | null;
  /** `seconds` is the realtime `typing` event's TTL (falls back to a default in the caller when
   * 0/undefined) — kept optional so non-realtime callers (tests, other future call sites) aren't
   * forced to pass it. Not used by this store itself; use-realtime-handlers.ts reads it back out
   * to schedule the matching typing-timers.ts expiry. */
  setTyping: (conversationId: string, typing: boolean, seconds?: number) => void;
  setDraft: (conversationId: string, text: string) => void;
  setComposerMode: (conversationId: string, mode: ComposerMode | undefined) => void;
  setUploadProgress: (clientId: string, ratio: number) => void;
  clearUploadProgress: (clientId: string) => void;
  setActiveConversationId: (conversationId: string | null) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  typingByConversation: {},
  draftsByConversation: {},
  composerModeByConversation: {},
  uploadProgressByClientId: {},
  activeConversationId: null,
  setTyping: (conversationId, typing) =>
    set((state) => ({
      typingByConversation: { ...state.typingByConversation, [conversationId]: typing },
    })),
  setActiveConversationId: (conversationId) => set({ activeConversationId: conversationId }),
  setDraft: (conversationId, text) =>
    set((state) => ({
      draftsByConversation: { ...state.draftsByConversation, [conversationId]: text },
    })),
  setComposerMode: (conversationId, mode) =>
    set((state) => ({
      composerModeByConversation: { ...state.composerModeByConversation, [conversationId]: mode },
    })),
  setUploadProgress: (clientId, ratio) =>
    set((state) => ({
      uploadProgressByClientId: { ...state.uploadProgressByClientId, [clientId]: ratio },
    })),
  clearUploadProgress: (clientId) =>
    set((state) => {
      const { [clientId]: _removed, ...rest } = state.uploadProgressByClientId;
      return { uploadProgressByClientId: rest };
    }),
}));
