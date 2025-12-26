/**
 * Tests for pagination utilities
 */

import {
  encodeCursor,
  decodeCursor,
  paginate,
  DEFAULT_PAGE_SIZE,
} from "../../src/utils/pagination.js";

describe("Pagination", () => {
  describe("encodeCursor", () => {
    it("should encode a cursor", () => {
      const cursor = encodeCursor(0);
      expect(typeof cursor).toBe("string");
      expect(cursor.length).toBeGreaterThan(0);
    });

    it("should encode different offsets differently", () => {
      const cursor1 = encodeCursor(0);
      const cursor2 = encodeCursor(50);
      expect(cursor1).not.toBe(cursor2);
    });

    it("should be base64 encoded", () => {
      const cursor = encodeCursor(100);
      // Base64 regex
      expect(cursor).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe("decodeCursor", () => {
    it("should decode a valid cursor", () => {
      const cursor = encodeCursor(42);
      const offset = decodeCursor(cursor);
      expect(offset).toBe(42);
    });

    it("should return 0 for undefined cursor", () => {
      const offset = decodeCursor(undefined);
      expect(offset).toBe(0);
    });

    it("should return 0 for invalid cursor", () => {
      const offset = decodeCursor("invalid-base64");
      expect(offset).toBe(0);
    });

    it("should return 0 for negative offsets", () => {
      const cursor = Buffer.from(JSON.stringify({ offset: -10 })).toString("base64");
      const offset = decodeCursor(cursor);
      expect(offset).toBe(0);
    });

    it("should round-trip correctly", () => {
      const original = 123;
      const cursor = encodeCursor(original);
      const decoded = decodeCursor(cursor);
      expect(decoded).toBe(original);
    });
  });

  describe("paginate", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);

    it("should return first page when no cursor provided", () => {
      const result = paginate(items, undefined, 10);

      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toBe(0);
      expect(result.items[9]).toBe(9);
      expect(result.nextCursor).toBeDefined();
    });

    it("should return correct page with cursor", () => {
      const cursor = encodeCursor(10);
      const result = paginate(items, cursor, 10);

      expect(result.items).toHaveLength(10);
      expect(result.items[0]).toBe(10);
      expect(result.items[9]).toBe(19);
    });

    it("should return nextCursor when there are more items", () => {
      const result = paginate(items, undefined, 10);
      expect(result.nextCursor).toBeDefined();

      const nextCursor = result.nextCursor;
      if (nextCursor) {
        const nextOffset = decodeCursor(nextCursor);
        expect(nextOffset).toBe(10);
      }
    });

    it("should not return nextCursor on last page", () => {
      const cursor = encodeCursor(90);
      const result = paginate(items, cursor, 10);

      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle partial last page", () => {
      const cursor = encodeCursor(95);
      const result = paginate(items, cursor, 10);

      expect(result.items).toHaveLength(5);
      expect(result.items[0]).toBe(95);
      expect(result.items[4]).toBe(99);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should use default page size", () => {
      const result = paginate(items, undefined);
      expect(result.items).toHaveLength(Math.min(DEFAULT_PAGE_SIZE, items.length));
    });

    it("should handle empty array", () => {
      const result = paginate([], undefined, 10);
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle array smaller than page size", () => {
      const smallArray = [1, 2, 3];
      const result = paginate(smallArray, undefined, 10);

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle cursor beyond array length", () => {
      const cursor = encodeCursor(200);
      const result = paginate(items, cursor, 10);

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should support iterating through all pages", () => {
      const pageSize = 10;
      const allItems: number[] = [];
      let cursor: string | undefined = undefined;

      while (true) {
        const result: { items: number[]; nextCursor?: string } = paginate(
          items,
          cursor,
          pageSize
        );
        allItems.push(...result.items);

        if (!result.nextCursor) {
          break;
        }

        cursor = result.nextCursor;
      }

      expect(allItems).toEqual(items);
    });
  });
});
