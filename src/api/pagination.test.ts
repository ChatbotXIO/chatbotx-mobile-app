import { flattenPages, getNextPageParam } from '@/api/pagination';
import type { CursorPage } from '@/api/pagination';

describe('getNextPageParam', () => {
  it('returns the cursor when present', () => {
    const page: CursorPage<number> = { data: [1, 2], nextCursor: 'abc' };
    expect(getNextPageParam(page)).toBe('abc');
  });

  it('returns undefined when nextCursor is null', () => {
    const page: CursorPage<number> = { data: [1, 2], nextCursor: null };
    expect(getNextPageParam(page)).toBeUndefined();
  });
});

describe('flattenPages', () => {
  it('flattens data across multiple pages in order', () => {
    const pages: CursorPage<number>[] = [
      { data: [1, 2], nextCursor: 'a' },
      { data: [3, 4], nextCursor: null },
    ];
    expect(flattenPages(pages)).toEqual([1, 2, 3, 4]);
  });

  it('returns an empty array for undefined pages', () => {
    expect(flattenPages(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty pages array', () => {
    expect(flattenPages([])).toEqual([]);
  });
});
