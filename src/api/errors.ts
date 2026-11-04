/**
 * Normalizes the oRPC error wire shape (`{ code, status, message, defined }` — verified against
 * the running backend) into a discriminated union the rest of the app can switch on. `openapi-fetch` doesn't throw on HTTP errors — it resolves `{ data, error }` — so
 * every mutation/query hook's `queryFn`/`mutationFn` must check `error` and
 * `throw new ApiError(error)` for react-query's QueryCache/MutationCache `onError` (wired in
 * lib/query-client.ts) to see it. Business-rule errors (ChatbotXException) surface their own
 * `code`/`status`, e.g. `workspaceBlocked` at 402.
 */
export interface ApiErrorBody {
  code?: string;
  status?: number;
  message?: string;
  defined?: boolean;
  /** Backend error payloads are resource-specific and may be absent. */
  data?: unknown;
}

export type NormalizedApiError =
  | { kind: 'unauthorized' }
  | { kind: 'mustChangePassword' }
  | { kind: 'workspaceBlocked'; reason: 'mac' | 'trialExpired' | 'unknown'; message: string }
  | { kind: 'notFound' }
  | { kind: 'tooManyRequests'; message: string }
  | { kind: 'invalidRequestData'; message: string }
  | { kind: 'invalidCursor' }
  | { kind: 'workspaceSelectionRequired' }
  | { kind: 'imagesNotSupportedOnChannel'; message: string }
  | { kind: 'unknown'; message: string };

const MUST_CHANGE_PASSWORD_MESSAGE = 'Password change required';

/** Thrown by hooks when `openapi-fetch` resolves an `error` body, so react-query's error
 * channel (retry, onError, `error` from useQuery) sees API failures. */
export class ApiError extends Error {
  readonly body: ApiErrorBody;

  constructor(body: ApiErrorBody) {
    super(body.message ?? 'API error');
    this.name = 'ApiError';
    this.body = body;
  }
}

function classifyWorkspaceBlockedReason(
  message: string,
  data: unknown,
): 'mac' | 'trialExpired' | 'unknown' {
  let dataReason: unknown;
  if (typeof data === 'object' && data !== null && 'reason' in data) {
    dataReason = data.reason;
  }
  if (dataReason === 'mac' || dataReason === 'trialExpired') {
    return dataReason;
  }

  const lowered = message.toLowerCase();
  if (lowered.includes('contact limit')) return 'mac';
  if (lowered.includes('trial') || lowered.includes('expired')) return 'trialExpired';
  return 'unknown';
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  const body: ApiErrorBody | null = error instanceof ApiError ? error.body : null;

  if (!body) {
    return { kind: 'unknown', message: error instanceof Error ? error.message : 'Unknown error' };
  }

  if (body.code === 'FORBIDDEN' && body.message === MUST_CHANGE_PASSWORD_MESSAGE) {
    return { kind: 'mustChangePassword' };
  }
  if (
    body.code === 'UNAUTHORIZED' ||
    body.code === 'INVALID_CHATBOT_TOKEN' ||
    body.status === 401
  ) {
    return { kind: 'unauthorized' };
  }
  // The public API signals a blocked workspace with a 403 carrying `trialExpired` or
  // `macLimitReached`; the legacy 402 `workspaceBlocked` shape is still recognized.
  if (body.code === 'trialExpired' || body.code === 'macLimitReached') {
    return {
      kind: 'workspaceBlocked',
      reason: body.code === 'macLimitReached' ? 'mac' : 'trialExpired',
      message: body.message ?? 'This workspace is currently unavailable.',
    };
  }
  if (body.code === 'workspaceBlocked' || body.status === 402) {
    const message = body.message ?? 'This workspace is currently unavailable.';
    return {
      kind: 'workspaceBlocked',
      reason: classifyWorkspaceBlockedReason(message, body.data),
      message,
    };
  }
  if (body.code === 'NOT_FOUND' || body.code === 'notFound' || body.status === 404) {
    return { kind: 'notFound' };
  }
  if (body.code === 'tooManyRequests' || body.status === 429) {
    return { kind: 'tooManyRequests', message: body.message ?? 'Too many requests' };
  }
  if (body.code === 'WORKSPACE_SELECTION_REQUIRED') {
    return { kind: 'workspaceSelectionRequired' };
  }
  if (body.code === 'invalidCursor') {
    return { kind: 'invalidCursor' };
  }
  if (body.code === 'imagesNotSupportedOnChannel') {
    return {
      kind: 'imagesNotSupportedOnChannel',
      message: body.message ?? 'Images are not supported on this channel',
    };
  }
  if (body.code === 'invalidRequestData' || body.code === 'validation' || body.status === 422) {
    return { kind: 'invalidRequestData', message: body.message ?? 'Invalid request' };
  }
  return { kind: 'unknown', message: body.message ?? 'Unknown error' };
}
