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

export function getNextPageParam<T>(page: CursorPage<T>): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenPages<T>(pages: CursorPage<T>[] | undefined): T[] {
  return pages?.flatMap((page) => page.data) ?? [];
}
