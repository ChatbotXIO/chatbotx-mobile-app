import type BottomSheet from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceBlockedGate } from '@/components/workspace-blocked-gate';
import { normalizeApiError } from '@/api/errors';
import { describeApiError } from '@/lib/describe-api-error';
import { AssignmentSheet } from '@/features/conversations/components/assignment-sheet';
import { useAssignConversations } from '@/features/conversations/api/use-conversation-actions';
import { useContactDetail } from '@/features/contacts/api/use-contact-detail';
import { ContactHeader, type ContactPanelOrigin } from '@/features/contacts/contact-header';
import { findContactInListCache } from '@/features/contacts/lib/find-contact-in-cache';
import { InfoTab } from '@/features/contacts/info-tab';
import { NotesTab } from '@/features/contacts/notes-tab';
import { SequencesTab } from '@/features/contacts/sequences-tab';
import { TagsTab } from '@/features/contacts/tags-tab';
import { useTheme } from '@/theme/use-theme';

type Tab = 'info' | 'tags' | 'notes' | 'sequences';

interface ContactPanelProps {
  workspaceId: string | null;
  contactId: string | null;
  /** Which route opened this panel — see contact-header.tsx's `ContactHeaderProps.origin` doc.
   * Defaults to 'directory' (the more common entry point, and the safer default for the
   * "Message" CTA's push-forward behavior). */
  origin?: ContactPanelOrigin;
  /**
   * Authoritative channel/conversation data the caller already has on hand (e.g. the
   * conversation-nested route already fetched its own `conversation` object, which embeds
   * `contactInboxes` directly — no need to fall back to a cache scan). When omitted, falls back
   * to `findContactInListCache` (best-effort scan of the contacts-list cache — see that file's
   * doc comment for why `useContactDetail` alone can't supply this).
   */
  channels?: string[];
  conversationId?: string | null;
}

/** Shared by both contact-detail routes ((app)/contacts/[contactId] and
 * (app)/conversations/[conversationId]/contact) — same tabs, same data source.
 *
 * All four tabs render inline into ONE scroll container owned by this panel (with pull-to-
 * refresh), rather than each tab owning its own ScrollView/FlatList — fixes the audit finding
 * about inconsistent scroll behavior across Info/Tags/Sequences. */
export function ContactPanel({
  workspaceId,
  contactId,
  origin = 'directory',
  channels: channelsOverride,
  conversationId: conversationIdOverride,
}: ContactPanelProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('info');
  const assignmentSheetRef = useRef<BottomSheet>(null);
  const {
    data: contact,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useContactDetail(workspaceId, contactId);
  const assignMutation = useAssignConversations(workspaceId ?? '');

  const cachedListEntry =
    !channelsOverride && workspaceId && contactId
      ? findContactInListCache(queryClient, workspaceId, contactId)
      : undefined;
  const channels =
    channelsOverride ?? cachedListEntry?.contactInboxes?.map((inbox) => inbox.channel) ?? [];
  const conversationId =
    conversationIdOverride !== undefined
      ? conversationIdOverride
      : (cachedListEntry?.conversation?.id ?? null);

  if (isLoading) {
    return (
      <Screen padded>
        <Skeleton height={72} borderRadius={36} style={{ alignSelf: 'center' }} />
        <View style={{ height: spacing.md }} />
        <Skeleton height={16} />
      </Screen>
    );
  }

  if (error) {
    const normalized = normalizeApiError(error);
    if (normalized.kind === 'workspaceBlocked') {
      return (
        <Screen>
          <WorkspaceBlockedGate reason={normalized.reason} message={normalized.message} />
        </Screen>
      );
    }
    return (
      <Screen padded>
        <ErrorBanner
          message={describeApiError(error, t)}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      </Screen>
    );
  }

  if (!contact) {
    return (
      <Screen padded>
        <EmptyState title={t('errors.notFound')} />
      </Screen>
    );
  }

  function handleAssign(userId: string | null) {
    if (!contact) return;
    assignMutation.mutate({ contactIds: [contact.id], assignedId: userId });
    assignmentSheetRef.current?.close();
  }

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        <ContactHeader
          contact={contact}
          origin={origin}
          channels={channels}
          conversationId={conversationId}
          onAssign={workspaceId ? () => assignmentSheetRef.current?.expand() : undefined}
        />
        <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'info', label: t('contacts.tabInfo') },
              { value: 'tags', label: t('contacts.tabTags') },
              { value: 'notes', label: t('contacts.tabNotes') },
              { value: 'sequences', label: t('contacts.tabSequences') },
            ]}
          />
        </View>
        {tab === 'info' ? <InfoTab contact={contact} workspaceId={workspaceId} /> : null}
        {tab === 'tags' && workspaceId ? (
          <TagsTab contact={contact} workspaceId={workspaceId} />
        ) : null}
        {tab === 'notes' ? <NotesTab contact={contact} workspaceId={workspaceId} /> : null}
        {tab === 'sequences' ? <SequencesTab contact={contact} workspaceId={workspaceId} /> : null}
      </ScrollView>
      {workspaceId ? (
        <AssignmentSheet
          sheetRef={assignmentSheetRef}
          workspaceId={workspaceId}
          onAssign={handleAssign}
        />
      ) : null}
    </Screen>
  );
}
