/**
 * Unit tests for HighlightStorage service
 */

// NOTE: Don't use jest.mock("@plasmohq/storage") because moduleNameMapper in jest.config.js
// already maps it to our mock implementation. Using jest.mock would auto-mock and replace our implementation.

// Mock logger to avoid console noise
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { HighlightStorage } from "./highlightStorage";
import type { StoredHighlight } from "../types/highlights";

// Get mock helpers using require to avoid TypeScript errors
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __clearMockStorage } = require("@plasmohq/storage");

describe("HighlightStorage", () => {
  let storage: HighlightStorage;

  // Factory function to create test highlights
  const createTestHighlight = (
    overrides: Partial<StoredHighlight> = {},
  ): StoredHighlight => ({
    id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url: "https://example.com/article",
    text: "Sample highlighted text",
    color: "beige",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    textBefore: "Context before ",
    textAfter: " context after",
    ...overrides,
  });

  beforeEach(() => {
    // Clear the mock storage before each test
    __clearMockStorage();
    storage = new HighlightStorage();
  });

  describe("getAllHighlights", () => {
    it("returns empty array when no highlights exist", async () => {
      const highlights = await storage.getAllHighlights();
      expect(highlights).toEqual([]);
    });

    it("returns all stored highlights after saving", async () => {
      // Save highlights first
      await storage.saveHighlight(createTestHighlight({ id: "h1" }));
      await storage.saveHighlight(createTestHighlight({ id: "h2" }));

      const highlights = await storage.getAllHighlights();
      expect(highlights).toHaveLength(2);
      expect(highlights.map((h) => h.id)).toContain("h1");
      expect(highlights.map((h) => h.id)).toContain("h2");
    });
  });

  describe("getPageHighlights", () => {
    it("returns only highlights for the specified URL", async () => {
      await storage.saveHighlight(
        createTestHighlight({ id: "h1", url: "https://example.com/page1" }),
      );
      await storage.saveHighlight(
        createTestHighlight({ id: "h2", url: "https://example.com/page2" }),
      );
      await storage.saveHighlight(
        createTestHighlight({ id: "h3", url: "https://example.com/page1" }),
      );

      const page1Highlights = await storage.getPageHighlights(
        "https://example.com/page1",
      );
      expect(page1Highlights).toHaveLength(2);
      expect(
        page1Highlights.every((h) => h.url === "https://example.com/page1"),
      ).toBe(true);
    });

    it("returns empty array when no highlights match URL", async () => {
      await storage.saveHighlight(
        createTestHighlight({ url: "https://example.com/page1" }),
      );

      const result = await storage.getPageHighlights(
        "https://example.com/other-page",
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when storage is empty", async () => {
      const result = await storage.getPageHighlights("https://example.com");
      expect(result).toEqual([]);
    });
  });

  describe("saveHighlight", () => {
    it("saves a new highlight to empty storage", async () => {
      const highlight = createTestHighlight({ id: "new-highlight" });

      await storage.saveHighlight(highlight);

      const highlights = await storage.getAllHighlights();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].id).toBe("new-highlight");
    });

    it("appends to existing highlights", async () => {
      await storage.saveHighlight(createTestHighlight({ id: "existing" }));
      await storage.saveHighlight(createTestHighlight({ id: "new" }));

      const highlights = await storage.getAllHighlights();
      expect(highlights).toHaveLength(2);
      expect(highlights.map((h) => h.id)).toContain("existing");
      expect(highlights.map((h) => h.id)).toContain("new");
    });

    it("preserves all highlight properties", async () => {
      const highlight = createTestHighlight({
        id: "test-id",
        url: "https://test.com",
        text: "Test text",
        color: "cyan",
        note: "A note",
        textBefore: "before",
        textAfter: "after",
        domPath: ["div", "p", "span"],
        nodeIndex: 2,
        start: 100,
        end: 200,
        exact: "Test text",
        prefix: "prefix",
        suffix: "suffix",
      });

      await storage.saveHighlight(highlight);

      const highlights = await storage.getAllHighlights();
      expect(highlights[0]).toMatchObject({
        id: "test-id",
        url: "https://test.com",
        text: "Test text",
        color: "cyan",
        note: "A note",
      });
    });
  });

  describe("updateHighlight", () => {
    it("updates an existing highlight", async () => {
      await storage.saveHighlight(
        createTestHighlight({
          id: "h1",
          text: "Original text",
          color: "beige",
        }),
      );

      const result = await storage.updateHighlight("h1", {
        text: "Updated text",
        color: "cyan",
      });

      expect(result).toBe(true);
      const highlights = await storage.getAllHighlights();
      expect(highlights[0].text).toBe("Updated text");
      expect(highlights[0].color).toBe("cyan");
    });

    it("sets updatedAt timestamp on update", async () => {
      const originalTime = Date.now() - 10000;
      await storage.saveHighlight(
        createTestHighlight({ id: "h1", updatedAt: originalTime }),
      );

      await storage.updateHighlight("h1", { note: "New note" });

      const highlights = await storage.getAllHighlights();
      expect(highlights[0].updatedAt).toBeGreaterThan(originalTime);
    });

    it("returns false when highlight not found", async () => {
      await storage.saveHighlight(createTestHighlight({ id: "h1" }));

      const result = await storage.updateHighlight("nonexistent", {
        note: "New note",
      });

      expect(result).toBe(false);
    });
  });

  describe("deleteHighlight", () => {
    it("deletes an existing highlight", async () => {
      await storage.saveHighlight(createTestHighlight({ id: "h1" }));
      await storage.saveHighlight(createTestHighlight({ id: "h2" }));

      const result = await storage.deleteHighlight("h1");

      expect(result).toBe(true);
      const highlights = await storage.getAllHighlights();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].id).toBe("h2");
    });

    it("returns false when highlight not found", async () => {
      await storage.saveHighlight(createTestHighlight({ id: "h1" }));

      const result = await storage.deleteHighlight("nonexistent");

      expect(result).toBe(false);
    });

    it("handles deletion from empty storage", async () => {
      const result = await storage.deleteHighlight("any-id");
      expect(result).toBe(false);
    });

    it("can delete the last highlight", async () => {
      await storage.saveHighlight(createTestHighlight({ id: "only-one" }));

      const result = await storage.deleteHighlight("only-one");

      expect(result).toBe(true);
      const highlights = await storage.getAllHighlights();
      expect(highlights).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles special characters in highlight text", async () => {
      const highlight = createTestHighlight({
        id: "special",
        text: 'Special chars: "quotes" & <tags> \n newlines',
      });

      await storage.saveHighlight(highlight);

      const highlights = await storage.getAllHighlights();
      expect(highlights[0].text).toBe(
        'Special chars: "quotes" & <tags> \n newlines',
      );
    });

    it("handles unicode text", async () => {
      const highlight = createTestHighlight({
        id: "unicode",
        text: "中文文本 日本語 한국어 🎉 emoji",
      });

      await storage.saveHighlight(highlight);

      const highlights = await storage.getAllHighlights();
      expect(highlights[0].text).toBe("中文文本 日本語 한국어 🎉 emoji");
    });

    it("handles very long text content", async () => {
      const longText = "a".repeat(10000);
      const highlight = createTestHighlight({
        id: "long-text",
        text: longText,
      });

      await storage.saveHighlight(highlight);

      const highlights = await storage.getAllHighlights();
      expect(highlights[0].text).toBe(longText);
    });
  });
});
