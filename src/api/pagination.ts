/**
 * Cursor-pagination helpers shared by every `useInfiniteQuery` hook. The generated schema's
 * cursor-paginated list responses share the `{ data: T[], nextCursor: string | null, prevCursor:
 * string | null }` shape — verified directly against every cursor-paginated operation in
 * src/api/generated/schema.ts (conversations/list and 5 others); the real wire shape differs
 * from the initial assumption of `{ items, nextCursor }`.
 */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor?: string | null;
}

/** Page-number pagination used by the `/v1` catalog endpoints. */
export interface OffsetPage<T> {
  data: T[];
  pageCount: number;
  totalCount?: number;
}

export function getNextPageParam<T>(page: CursorPage<T>): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenPages<T>(pages: CursorPage<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.data) ?? [];
}

/** Largest `perPage` the `/v1` catalog endpoints accept. */
export const MAX_PER_PAGE = 50;

/** Safety valve so a misbehaving `pageCount` can never loop forever. */
const MAX_PAGES = 100;

/**
 * Drains a page-numbered `/v1` list endpoint into one array. `fetchPage` receives a 1-based page
 * number and must resolve to `{ data, pageCount }`; it should throw on a request error.
 * Pages are fetched sequentially so a failure stops further requests.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<OffsetPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let pageCount = 1;

  for (let page = 1; page <= pageCount && page <= MAX_PAGES; page += 1) {
    const result = await fetchPage(page);
    items.push(...result.data);
    pageCount = result.pageCount;
  }

  return items;
}
