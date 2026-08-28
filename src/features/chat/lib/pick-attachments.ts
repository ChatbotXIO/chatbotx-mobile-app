import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

/** Cap on how many assets a single multi-select library pick can return — an arbitrary but
 * generous ceiling to keep one send from trying to upload an unbounded number of files. */
const MAX_MULTI_SELECT = 10;

export interface PickedAsset {
  uri: string;
  mimeType: string;
  fileName: string;
  /** Bytes, when the picker reports it — undefined means "unknown, don't size-gate this one
   * client-side" (the camera capture path is the main case; server-side rejection is the fallback
   * per the AGENTS/plan notes on camera.tsx). */
  size?: number;
}

/** Opens the system photo/video library in multi-select mode. Returns `[]` on cancel — callers
 * don't need to branch on `result.canceled` themselves. */
export async function pickFromLibrary(): Promise<PickedAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_MULTI_SELECT,
    quality: 0.9,
  });

  if (result.canceled) return [];

  return result.assets.map((asset, index) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    fileName:
      asset.fileName ??
      `attachment-${Date.now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
    size: asset.fileSize ?? undefined,
  }));
}

/** Opens the system document picker in multi-select mode. Returns `[]` on cancel. */
export async function pickDocuments(): Promise<PickedAsset[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    fileName: asset.name,
    size: asset.size ?? undefined,
  }));
}

export interface PartitionResult<T extends PickedAsset> {
  ok: T[];
  tooLarge: T[];
}

/** Splits a batch of picked assets by a byte-size ceiling. Assets with unknown size (`size ===
 * undefined`) are treated as OK — there's nothing to gate against client-side, the server is the
 * final authority for those. Pure and synchronous so it's fully unit-testable without mocking any
 * picker module. */
export function partitionBySize<T extends PickedAsset>(
  assets: T[],
  maxBytes: number,
): PartitionResult<T> {
  const ok: T[] = [];
  const tooLarge: T[] = [];

  for (const asset of assets) {
    if (typeof asset.size === 'number' && asset.size > maxBytes) {
      tooLarge.push(asset);
    } else {
      ok.push(asset);
    }
  }

  return { ok, tooLarge };
}
