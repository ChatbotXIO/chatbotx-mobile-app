/**
 * Normalizes the oRPC error wire shape (`{ code, status, message, defined }` — verified live
 * against the aha.chat builder dev server) into a discriminated union the rest of the app can
 * switch on. `openapi-fetch` doesn't throw on HTTP errors — it resolves `{ data, error }` — so
 * every mutation/query hook's `queryFn`/`mutationFn` must check `error` and
 * `throw new ApiError(error)` for react-query's QueryCache/MutationCache `onError` (wired in
 * lib/query-client.ts) to see it. Business-rule errors (ChatbotXException) surface their own
 * `code`/`status`, e.g. `workspaceBlocked` at 402 — see aha.chat apps/builder/src/orpc.ts.
 */
export interface ApiErrorBody {
  code?: string;
  status?: number;
  message?: string;
  defined?: boolean;
  /**
   * Machine-readable payload some business-rule errors may attach. `data.reason` is a forward-
   * compatible hook for the 402 `workspaceBlocked` error: the backend does not send it today (as
   * of this writing `classifyWorkspaceBlockedReason` below is the only source of truth, matched
   * by English substring against `message` — see plan's "backend ask" #2), but once it does, this
   * field is read first and the substring match becomes pure fallback. No schema for `data` exists
   * yet in `src/api/generated/schema.ts`, so this stays loosely typed until the backend ships it.
   */
  data?: { reason?: string };
}

export type NormalizedApiError =
  | { kind: 'unauthorized' }
  | { kind: 'mustChangePassword' }
  | { kind: 'workspaceBlocked'; reason: 'mac' | 'trialExpired' | 'unknown'; message: string }
  | { kind: 'notFound' }
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

/** Machine-readable reason codes the backend may eventually send in `data.reason`. Any other
 * string value falls through to the substring-matching fallback below rather than being trusted
 * blindly, in case the backend ships a value this app doesn't recognize yet. */
const KNOWN_REASON_CODES = new Set(['mac', 'trialExpired']);

function classifyWorkspaceBlockedReason(
  message: string,
  dataReason: string | undefined,
): 'mac' | 'trialExpired' | 'unknown' {
  if (dataReason && KNOWN_REASON_CODES.has(dataReason)) {
    return dataReason as 'mac' | 'trialExpired';
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
  if (body.code === 'UNAUTHORIZED' || body.status === 401) {
    return { kind: 'unauthorized' };
  }
  if (body.code === 'workspaceBlocked' || body.status === 402) {
    const message = body.message ?? 'This workspace is currently unavailable.';
    return {
      kind: 'workspaceBlocked',
      reason: classifyWorkspaceBlockedReason(message, body.data?.reason),
      message,
    };
  }
  if (body.code === 'NOT_FOUND' || body.status === 404) {
    return { kind: 'notFound' };
  }
  return { kind: 'unknown', message: body.message ?? 'Unknown error' };
}
