import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

import { sendMultipartMessage } from './send-message-multipart';

jest.mock('@/api/client', () => ({
  apiClient: { POST: jest.fn() },
}));

const mockPost = apiClient.POST as jest.Mock;

/** Minimal fake of RN's XMLHttpRequest: tests drive `onload`/`onerror` and `upload.onprogress`
 * by hand, since Jest's `react-native` preset has no network layer. */
class FakeXHR {
  static instances: FakeXHR[] = [];

  status = 0;
  statusText = '';
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  method?: string;
  url?: string;
  headers: Record<string, string> = {};
  sentBody?: unknown;

  constructor() {
    FakeXHR.instances.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.sentBody = body;
  }
}

/** The upload starts after two awaited API calls and a local-file fetch, so the XHR appears a few
 * microtasks later; poll across turns instead of assuming an exact hop count. */
async function waitForXhr(index = 0): Promise<FakeXHR> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const xhr = FakeXHR.instances[index];
    if (xhr) return xhr;
    await Promise.resolve();
  }
  throw new Error('Expected an XMLHttpRequest to be constructed');
}

const PHOTO = { uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg', fileName: 'photo.jpg' };
const DOC = { uri: 'file:///tmp/doc.pdf', mimeType: 'application/pdf', fileName: 'doc.pdf' };

const BASE_PARAMS = {
  workspaceId: 'ws-1',
  conversationId: 'conv-1',
  clientId: 'client-1',
  attachments: [PHOTO],
};

function mockHappyPath() {
  let fileCounter = 0;
  mockPost.mockImplementation(async (path: string) => {
    if (path === '/v1/media-library/files/upload-url') {
      fileCounter += 1;
      return {
        data: {
          path: `uploads/${fileCounter}`,
          uploadUrl: `https://storage.test/put/${fileCounter}?sig=abc`,
          publicUrl: '',
        },
      };
    }
    if (path === '/v1/media-library/files') {
      return { data: { id: `file-${fileCounter}` } };
    }
    return { data: { id: 'msg-1' } };
  });
}

describe('sendMultipartMessage', () => {
  const originalXHR = global.XMLHttpRequest;
  const originalFetch = global.fetch;

  beforeEach(() => {
    FakeXHR.instances = [];
    mockPost.mockReset();
    global.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
    global.fetch = jest.fn().mockResolvedValue({
      blob: async () => ({ size: 1234 }) as Blob,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.XMLHttpRequest = originalXHR;
    global.fetch = originalFetch;
  });

  it('requests an upload URL, PUTs the bytes without a Bearer header, registers the file, then sends the message', async () => {
    mockHappyPath();
    const promise = sendMultipartMessage({ ...BASE_PARAMS, text: 'look' });

    const xhr = await waitForXhr();
    expect(mockPost).toHaveBeenCalledWith('/v1/media-library/files/upload-url', {
      body: { fileName: 'photo.jpg', mimeType: 'image/jpeg' },
    });
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('https://storage.test/put/1?sig=abc');
    expect(xhr.headers['Content-Type']).toBe('image/jpeg');
    expect(xhr.headers.Authorization).toBeUndefined();

    xhr.status = 200;
    xhr.onload?.();
    await expect(promise).resolves.toEqual({ id: 'msg-1' });

    expect(mockPost).toHaveBeenCalledWith('/v1/media-library/files', {
      body: { name: 'photo.jpg', path: 'uploads/1', mimeType: 'image/jpeg', size: 1234 },
    });
    expect(mockPost).toHaveBeenLastCalledWith('/v1/conversations/{conversationId}/messages', {
      params: { path: { conversationId: 'conv-1' } },
      body: expect.objectContaining({
        text: 'look',
        clientId: 'client-1',
        mediaFileIds: ['file-1'],
      }),
    });
  });

  it('uploads several attachments in order and reports overall progress', async () => {
    mockHappyPath();
    const onProgress = jest.fn();
    const promise = sendMultipartMessage({
      ...BASE_PARAMS,
      attachments: [PHOTO, DOC],
      onProgress,
    });

    const first = await waitForXhr(0);
    first.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    expect(onProgress).toHaveBeenLastCalledWith(0.25);
    first.status = 200;
    first.onload?.();

    const second = await waitForXhr(1);
    second.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    expect(onProgress).toHaveBeenLastCalledWith(0.75);
    second.status = 200;
    second.onload?.();

    await promise;
    expect(mockPost).toHaveBeenLastCalledWith(
      '/v1/conversations/{conversationId}/messages',
      expect.objectContaining({
        body: expect.objectContaining({ mediaFileIds: ['file-1', 'file-2'] }),
      }),
    );
  });

  it('rejects with an ApiError and never sends the message when the storage PUT fails', async () => {
    mockHappyPath();
    const promise = sendMultipartMessage(BASE_PARAMS);

    const xhr = await waitForXhr();
    xhr.status = 403;
    xhr.statusText = 'Forbidden';
    xhr.onload?.();

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    expect(mockPost).not.toHaveBeenCalledWith(
      '/v1/conversations/{conversationId}/messages',
      expect.anything(),
    );
  });

  it('rejects with a status-0 ApiError on a network error', async () => {
    mockHappyPath();
    const promise = sendMultipartMessage(BASE_PARAMS);

    const xhr = await waitForXhr();
    xhr.onerror?.();

    await expect(promise).rejects.toMatchObject({ body: { status: 0 } });
  });

  it('surfaces an API error body from the message-create call as an ApiError', async () => {
    mockPost.mockImplementation(async (path: string) => {
      if (path === '/v1/media-library/files/upload-url') {
        return { data: { path: 'p', uploadUrl: 'https://storage.test/put', publicUrl: '' } };
      }
      if (path === '/v1/media-library/files') return { data: { id: 'file-1' } };
      return { error: { code: 'imagesNotSupportedOnChannel', status: 422, message: 'nope' } };
    });
    const promise = sendMultipartMessage(BASE_PARAMS);

    const xhr = await waitForXhr();
    xhr.status = 200;
    xhr.onload?.();

    await expect(promise).rejects.toMatchObject({
      body: { code: 'imagesNotSupportedOnChannel', status: 422 },
    });
  });
});
