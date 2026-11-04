import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { operations } from '@/api/generated/schema';
import { queryKeys } from '@/api/query-keys';
import { toContactIdentifier } from '@/features/contacts/lib/contact-identifier';

type GetContactResponse =
  operations['contacts.get']['responses'][200]['content']['application/json'];
type ContactCustomFieldsResponse =
  operations['contacts.listCustomFields']['responses'][200]['content']['application/json'];
type ContactSequencesResponse =
  operations['contacts.listSequences']['responses'][200]['content']['application/json'];

/** The slice of a tag the UI needs; assigned-tag rows and catalog rows both satisfy it. */
export interface ContactTag {
  id: string;
  name: string;
  folderId: string | null;
}

export type ContactCustomFieldValue = ContactCustomFieldsResponse['data'][number];
export type ContactSequenceEnrollment = ContactSequencesResponse['data'][number];

/**
 * The detail view's single contact object. `contacts.get` supplies the profile, tags, notes and
 * inboxes; custom-field values (with name/type) and sequence enrollments come from their own
 * `/v1` operations and are merged in here, so the panel's tabs all read off this one query.
 */
export type ContactDetail = Omit<
  GetContactResponse,
  'contactCustomFields' | 'tags' | 'contactNotes' | 'contactInboxes'
> & {
  tags: ContactTag[];
  contactNotes: NonNullable<GetContactResponse['contactNotes']>;
  contactInboxes: NonNullable<GetContactResponse['contactInboxes']>;
  customFields: ContactCustomFieldValue[];
  sequences: ContactSequenceEnrollment[];
};

export function useContactDetail(workspaceId: string | null, contactId: string | null) {
  return useQuery({
    queryKey: queryKeys.ws.contacts.detail(workspaceId ?? '', contactId ?? ''),
    enabled: workspaceId !== null && contactId !== null,
    queryFn: async (): Promise<ContactDetail> => {
      const identifier = toContactIdentifier(contactId!);
      const params = { path: { identifier } };

      const [contactResult, fieldsResult, sequencesResult] = await Promise.all([
        apiClient.GET('/v1/contacts/{identifier}', { params }),
        apiClient.GET('/v1/contacts/{identifier}/custom-fields', { params }),
        apiClient.GET('/v1/contacts/{identifier}/sequences', { params }),
      ]);

      if (contactResult.error) throw new ApiError(contactResult.error);
      if (fieldsResult.error) throw new ApiError(fieldsResult.error);
      if (sequencesResult.error) throw new ApiError(sequencesResult.error);

      const { contactCustomFields: _ignored, ...contact } = contactResult.data;
      return {
        ...contact,
        tags: (contact.tags ?? []).map(({ id, name, folderId }) => ({ id, name, folderId })),
        contactNotes: contact.contactNotes ?? [],
        contactInboxes: contact.contactInboxes ?? [],
        customFields: fieldsResult.data.data,
        sequences: sequencesResult.data.data,
      };
    },
  });
}
