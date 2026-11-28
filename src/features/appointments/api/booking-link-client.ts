import type { Client } from 'openapi-fetch';

import { apiClient } from '@/api/client';
import type { paths } from '@/api/generated/schema';

/** `POST /v1/conversations/{id}/appointment-booking-link` exists on the backend but is missing from
 * the committed `schema.ts` (regenerate with `pnpm generate:api` against a current backend). Until
 * then this declares just that route; once the generated schema contains it, delete this file and
 * call `apiClient` directly. */
export interface BookingLinkBody {
  calendarId: string;
  inboxId?: string;
  send: boolean;
}

export interface BookingLinkResult {
  url: string;
  expiresAt: string;
  calendar: { id: string; name: string };
  messageId?: string | null;
}

type BookingLinkPaths = {
  '/v1/conversations/{id}/appointment-booking-link': {
    parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
    post: {
      parameters: { query?: never; header?: never; path: { id: string }; cookie?: never };
      requestBody: { content: { 'application/json': BookingLinkBody } };
      responses: {
        200: {
          headers: Record<string, unknown>;
          content: { 'application/json': BookingLinkResult };
        };
      };
    };
  };
};

export const bookingLinkClient = apiClient as unknown as Client<paths & BookingLinkPaths>;
