/**
 * Pagination utilities for MCP list operations
 */

/**
 * Default page size for paginated responses
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Encode a pagination cursor (base64)
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString("base64");
}

/**
 * Decode a pagination cursor
 * Returns the offset or 0 if invalid
 */
export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return typeof parsed.offset === "number" && parsed.offset >= 0 ? parsed.offset : 0;
  } catch {
    // Invalid cursor, start from beginning
    return 0;
  }
}

/**
 * Paginate an array of items
 * Returns { items, nextCursor }
 */
export function paginate<T>(
  items: T[],
  cursor: string | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE
): {
  items: T[];
  nextCursor?: string;
} {
  const offset = decodeCursor(cursor);
  const endOffset = offset + pageSize;

  const pageItems = items.slice(offset, endOffset);

  // If there are more items, return nextCursor
  const hasMore = endOffset < items.length;
  const nextCursor = hasMore ? encodeCursor(endOffset) : undefined;

  return {
    items: pageItems,
    nextCursor,
  };
}
