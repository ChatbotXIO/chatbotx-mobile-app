import { setAuthToken } from '@/api/auth-token';
import { ApiError } from '@/api/errors';

import { sendMultipartMessage } from './send-message-multipart';

/** Minimal fake standing in for RN's FormData — RN's real polyfill (Libraries/Network/FormData.js)
 * keeps `append()`'d values verbatim in `_parts`, but Jest's test environment supplies Node's
 * built-in `FormData`, which stringifies any non-Blob/non-string value via `String(value)`. Since
 * the RN app never runs against that global, stubbing it here keeps the assertions faithful to
 * real on-device behavior instead of an artifact of the test environment. */
class FakeFormData {
  private parts: [string, unknown][] = [];

  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }

  getAll(key: string): unknown[] {
    return this.parts.filter(([name]) => name === key).map(([, value]) => value);
  }
}

/** Minimal fake standing in for RN's XMLHttpRequest — captures the constructed instance so each
 * test can drive `onload`/`onerror`/`onabort` manually, since Jest's `react-native` preset has no
 * real network layer to fire these callbacks itself. */
class FakeXHR {
  static instances: FakeXHR[] = [];

  readyState = 0;
  status = 0;
  statusText = '';
  responseText = '';
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  openedMethod?: string;
  openedUrl?: string;
  requestHeaders: Record<string, string> = {};
  sentBody?: unknown;

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.openedMethod = method;
    this.openedUrl = url;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: unknown) {
    this.sentBody = body;
  }
}

/** `sendMultipartMessage` awaits `getAuthToken()` (itself async, via expo-secure-store's mock)
 * BEFORE constructing the XHR — so the fake instance only exists some microtasks after the
 * function is called, not synchronously. Polls across microtask turns rather than a fixed count,
 * since the exact number of hops through the mock is an implementation detail. */
async function waitForXhr(): Promise<FakeXHR> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const xhr = FakeXHR.instances[0];
    if (xhr) return xhr;
    await Promise.resolve();
  }
  throw new Error('Expected sendMultipartMessage to construct an XMLHttpRequest');
}

function getFormPart(form: FormData, key: string): unknown {
  return (form as unknown as FakeFormData).getAll(key)[0];
}

const BASE_PARAMS = {
  workspaceId: 'ws-1',
  conversationId: 'conv-1',
  clientId: 'client-1',
  attachments: [{ uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg', fileName: 'photo.jpg' }],
};

describe('sendMultipartMessage', () => {
  const originalXHR = global.XMLHttpRequest;
  const originalFormData = global.FormData;

  beforeEach(() => {
    FakeXHR.instances = [];
    global.XMLHttpRequest = FakeXHR as any;
    global.FormData = FakeFormData as any;
  });

  afterEach(() => {
    global.XMLHttpRequest = originalXHR;
    global.FormData = originalFormData;
  });

  it('builds multipart form data with the file part and clientId', async () => {
    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    expect(xhr.openedMethod).toBe('POST');
    expect(xhr.openedUrl).toBe(
      'https://test.invalid/api/workspaces/ws-1/conversations/conv-1/messages',
    );

    const form = xhr.sentBody as FormData;
    expect(getFormPart(form, 'clientId')).toBe('client-1');
    expect(getFormPart(form, 'files')).toEqual({
      uri: 'file:///tmp/photo.jpg',
      type: 'image/jpeg',
      name: 'photo.jpg',
    });

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 'msg-1' });
    xhr.onload?.();

    await expect(promise).resolves.toEqual({ id: 'msg-1' });
  });

  it('includes optional text and reply fields only when provided', async () => {
    const promise = sendMultipartMessage({
      ...BASE_PARAMS,
      text: 'caption',
      replyToMessageId: 'parent-1',
      replyToMessageCreatedAt: '2026-01-01T00:00:00.000Z',
    });
    const xhr = await waitForXhr();
    const form = xhr.sentBody as FormData;

    expect(getFormPart(form, 'text')).toBe('caption');
    expect(getFormPart(form, 'replyToMessageId')).toBe('parent-1');
    expect(getFormPart(form, 'replyToMessageCreatedAt')).toBe('2026-01-01T00:00:00.000Z');

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 'msg-1' });
    xhr.onload?.();
    await promise;
  });

  it('reports upload progress via onProgress', async () => {
    const onProgress = jest.fn();
    const promise = sendMultipartMessage({ ...BASE_PARAMS, onProgress });
    const xhr = await waitForXhr();

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    expect(onProgress).toHaveBeenCalledWith(0.5);

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 'msg-1' });
    xhr.onload?.();
    await promise;
  });

  it('ignores progress events that are not length-computable', async () => {
    const onProgress = jest.fn();
    const promise = sendMultipartMessage({ ...BASE_PARAMS, onProgress });
    const xhr = await waitForXhr();

    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 0 } as ProgressEvent);
    expect(onProgress).not.toHaveBeenCalled();

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 'msg-1' });
    xhr.onload?.();
    await promise;
  });

  it('rejects with an ApiError built from the JSON error body on a non-2xx response', async () => {
    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    xhr.status = 402;
    xhr.statusText = 'Payment Required';
    xhr.responseText = JSON.stringify({ code: 'workspaceBlocked', message: 'blocked' });
    xhr.onload?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((error: ApiError) => {
      expect(error.body).toEqual({
        code: 'workspaceBlocked',
        status: 402,
        message: 'blocked',
        data: undefined,
      });
    });
  });

  it('falls back to statusText when the error response has no JSON body', async () => {
    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    xhr.status = 500;
    xhr.statusText = 'Internal Server Error';
    xhr.responseText = '';
    xhr.onload?.();

    await promise.catch((error: ApiError) => {
      expect(error.body.message).toBe('Internal Server Error');
      expect(error.body.status).toBe(500);
    });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects with an ApiError on a network error', async () => {
    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    xhr.onerror?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((error: ApiError) => {
      expect(error.body.message).toBe('Network request failed');
      expect(error.body.status).toBe(0);
    });
  });

  it('rejects with an ApiError on an aborted upload', async () => {
    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    xhr.onabort?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await promise.catch((error: ApiError) => {
      expect(error.body.message).toBe('Upload aborted');
    });
  });

  it('attaches a Bearer token header when one is stored', async () => {
    await setAuthToken('test-token');

    const promise = sendMultipartMessage(BASE_PARAMS);
    const xhr = await waitForXhr();

    expect(xhr.requestHeaders.Authorization).toBe('Bearer test-token');

    xhr.status = 201;
    xhr.responseText = JSON.stringify({ id: 'msg-1' });
    xhr.onload?.();
    await promise;
  });
});
