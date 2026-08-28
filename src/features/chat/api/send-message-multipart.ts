import { getAuthToken } from '@/api/auth-token';
import { ApiError } from '@/api/errors';
import { env } from '@/config/env';

/**
 * Chat message attachments go through the SAME message-create endpoint as text
 * (`POST /workspaces/{workspaceId}/conversations/{conversationId}/messages`), but the generated
 * TS types are wrong for this case: the backend's real Zod schema types `files` as
 * `z.array(z.instanceof(File)).min(1)`, which openapi-typescript cannot express — it collapsed to
 * `files?: unknown[]` under `application/json`. The real wire format for a request WITH files is
 * `multipart/form-data` (the backend's `createMessage` handler calls `uploadMultipleFiles` on
 * genuine binary uploads), not JSON. The typed `apiClient` assumes JSON everywhere, so attachment
 * sends bypass it entirely and use a hand-rolled request here (same pattern as api/auth-endpoints.ts
 * for other non-JSON-typed routes), building RN's standard FormData-with-file shape
 * (`{ uri, type, name }`) which works directly with expo-image-picker/expo-camera result URIs.
 *
 * UNVERIFIED: this multipart send has not been exercised against a live signed-in session with a
 * real conversation — the request shape is inferred from the backend's Zod schema and RN's FormData
 * convention, not observed on the wire. Worth a real-device check before shipping.
 *
 * Built on XMLHttpRequest rather than `fetch` specifically so upload progress is observable:
 * `fetch`'s ReadableStream request body isn't supported for uploads in RN's fetch polyfill, and
 * even where it is, there's no cross-platform equivalent of `xhr.upload.onprogress`. RN's XHR
 * implementation does implement `upload.onprogress` (backed by the native networking layer), so
 * this is the only way to surface a progress ratio to the composer/attachment UI. The success/error
 * contract (return value, thrown error types) is kept IDENTICAL to the previous fetch-based
 * implementation so use-send-message.ts needs no changes beyond passing through `onProgress`.
 */
export interface MultipartAttachment {
  uri: string;
  mimeType: string;
  fileName: string;
}

export interface SendMultipartMessageParams {
  workspaceId: string;
  conversationId: string;
  text?: string;
  clientId: string;
  attachments: MultipartAttachment[];
  inboxId?: string | null;
  replyToMessageId?: string;
  replyToMessageCreatedAt?: string;
  /** Called with a 0-1 ratio as the upload progresses. Best-effort — some environments never
   * report `lengthComputable`, in which case this simply never fires. */
  onProgress?: (ratio: number) => void;
}

function parseResponseBody(rawBody: string): unknown {
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    // Non-JSON response — leave body null, fall back to statusText below.
    return null;
  }
}

/** Builds an `ApiError` from a raw XHR response body, matching the shape
 * `normalizeApiError`/`ApiError` expect from the typed `apiClient` path (`{ code, status,
 * message }`) — so a 402/401/etc. from an attachment send is classified identically to a
 * JSON-body send instead of silently falling through as an unrecognized error type. */
function toApiError(status: number, body: unknown, fallbackMessage: string): ApiError {
  const parsedBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof parsedBody.code === 'string' ? parsedBody.code : undefined;
  const message = typeof parsedBody.message === 'string' ? parsedBody.message : fallbackMessage;
  const data =
    parsedBody.data && typeof parsedBody.data === 'object'
      ? (parsedBody.data as { reason?: string })
      : undefined;

  return new ApiError({ code, status, message, data });
}

export async function sendMultipartMessage(params: SendMultipartMessageParams): Promise<unknown> {
  const token = await getAuthToken();
  const url = `${env.apiBaseUrl}/api/workspaces/${params.workspaceId}/conversations/${params.conversationId}/messages`;

  const form = new FormData();
  if (params.text) form.append('text', params.text);
  form.append('clientId', params.clientId);
  if (params.inboxId) form.append('inboxId', params.inboxId);
  if (params.replyToMessageId) form.append('replyToMessageId', params.replyToMessageId);
  if (params.replyToMessageCreatedAt) {
    form.append('replyToMessageCreatedAt', params.replyToMessageCreatedAt);
  }
  for (const attachment of params.attachments) {
    // React Native's XHR/FormData accepts this `{ uri, type, name }` object in place of a real
    // Blob for file parts — the standard RN convention, distinct from web File/Blob uploads.
    form.append('files', {
      uri: attachment.uri,
      type: attachment.mimeType,
      name: attachment.fileName,
    } as unknown as Blob);
  }

  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && params.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          params.onProgress?.(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      const body = parseResponseBody(xhr.responseText);
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        reject(toApiError(xhr.status, body, xhr.statusText));
        return;
      }
      resolve(body);
    };

    xhr.onerror = () => {
      reject(toApiError(0, null, 'Network request failed'));
    };

    xhr.onabort = () => {
      reject(toApiError(0, null, 'Upload aborted'));
    };

    xhr.send(form);
  });
}
