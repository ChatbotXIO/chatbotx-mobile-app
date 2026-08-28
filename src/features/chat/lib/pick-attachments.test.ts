import { partitionBySize, type PickedAsset } from './pick-attachments';

function fakeAsset(overrides: Partial<PickedAsset> = {}): PickedAsset {
  return {
    uri: 'file:///tmp/a.jpg',
    mimeType: 'image/jpeg',
    fileName: 'a.jpg',
    ...overrides,
  };
}

describe('partitionBySize', () => {
  const MAX = 5 * 1000 * 1000;

  it('puts assets under the limit into ok', () => {
    const asset = fakeAsset({ size: MAX - 1 });

    const result = partitionBySize([asset], MAX);

    expect(result.ok).toEqual([asset]);
    expect(result.tooLarge).toEqual([]);
  });

  it('puts assets over the limit into tooLarge', () => {
    const asset = fakeAsset({ size: MAX + 1 });

    const result = partitionBySize([asset], MAX);

    expect(result.tooLarge).toEqual([asset]);
    expect(result.ok).toEqual([]);
  });

  it('treats an asset exactly at the limit as ok (not over)', () => {
    const asset = fakeAsset({ size: MAX });

    const result = partitionBySize([asset], MAX);

    expect(result.ok).toEqual([asset]);
  });

  it('treats assets with unknown size as ok', () => {
    const asset = fakeAsset({ size: undefined });

    const result = partitionBySize([asset], MAX);

    expect(result.ok).toEqual([asset]);
    expect(result.tooLarge).toEqual([]);
  });

  it('partitions a mixed batch correctly, preserving order within each bucket', () => {
    const small = fakeAsset({ fileName: 'small.jpg', size: 100 });
    const big1 = fakeAsset({ fileName: 'big1.jpg', size: MAX + 1 });
    const unknown = fakeAsset({ fileName: 'unknown.jpg', size: undefined });
    const big2 = fakeAsset({ fileName: 'big2.jpg', size: MAX + 500 });

    const result = partitionBySize([small, big1, unknown, big2], MAX);

    expect(result.ok).toEqual([small, unknown]);
    expect(result.tooLarge).toEqual([big1, big2]);
  });

  it('returns empty buckets for an empty input', () => {
    const result = partitionBySize([], MAX);

    expect(result).toEqual({ ok: [], tooLarge: [] });
  });
});
