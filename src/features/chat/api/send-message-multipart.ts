import { apiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

/**
 * Sends a chat message with attachments. The public API has no multipart message route, so each
 * file goes through the media library first, then the message references the registered files:
 *
 * 1. `mediaLibrary.createUploadUrl` → `{ path, uploadUrl }`
 * 2. `PUT` the file bytes to `uploadUrl` (object storage — NO Authorization header, the URL is
 *    already signed, and a stray Bearer token would both leak the JWT and break the signature)
 * 3. `mediaLibrary.createFile` → registered file `id`
 * 4. `messages.create` with `mediaFileIds`
 *
 * Step 2 uses XMLHttpRequest rather than `fetch` so upload progress is observable:
 * `fetch` has no cross-platform equivalent of `xhr.upload.onprogress` in React Native.
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
  /** Called with a 0-1 ratio covering all attachments as the upload progresses. Best-effort —
   * some environments never report `lengthComputable`, in which case this simply stays quiet. */
  onProgress?: (ratio: number) => void;
}

function toNetworkError(message: string): ApiError {
  return new ApiError({ status: 0, message });
}

/** PUTs `blob` to a pre-signed URL, reporting 0-1 progress for this single file. */
function putToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  mimeType: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      reject(new ApiError({ status: xhr.status, message: xhr.statusText || 'Upload failed' }));
    };
    xhr.onerror = () => reject(toNetworkError('Network request failed'));
    xhr.onabort = () => reject(toNetworkError('Upload aborted'));

    xhr.send(blob);
  });
}

/** Uploads one local file through steps 1-3 and returns the registered media-library file id. */
async function uploadAttachment(
  attachment: MultipartAttachment,
  onProgress: (ratio: number) => void,
): Promise<string> {
  const { data: slot, error: slotError } = await apiClient.POST(
    '/v1/media-library/files/upload-url',
    { body: { fileName: attachment.fileName, mimeType: attachment.mimeType } },
  );
  if (slotError) throw new ApiError(slotError);

  const localResponse = await fetch(attachment.uri);
  const blob = await localResponse.blob();

  await putToSignedUrl(slot.uploadUrl, blob, attachment.mimeType, onProgress);

  const { data: file, error: fileError } = await apiClient.POST('/v1/media-library/files', {
    body: {
      name: attachment.fileName,
      path: slot.path,
      mimeType: attachment.mimeType,
      size: blob.size,
    },
  });
  if (fileError) throw new ApiError(fileError);

  return file.id;
}

export async function sendMultipartMessage(params: SendMultipartMessageParams): Promise<unknown> {
  const total = params.attachments.length;
  const mediaFileIds: string[] = [];

  for (const [index, attachment] of params.attachments.entries()) {
    const id = await uploadAttachment(attachment, (ratio) =>
      params.onProgress?.((index + ratio) / total),
    );
    mediaFileIds.push(id);
  }

  const { data, error } = await apiClient.POST('/v1/conversations/{conversationId}/messages', {
    params: { path: { conversationId: params.conversationId } },
    body: {
      text: params.text || undefined,
      clientId: params.clientId,
      inboxId: params.inboxId ?? undefined,
      mediaFileIds,
      replyToMessageId: params.replyToMessageId,
      replyToMessageCreatedAt: params.replyToMessageCreatedAt,
    },
  });
  if (error) throw new ApiError(error);

  return data;
}
