/**
 * Unit tests for useArticle hook
 * Tests article extraction functionality
 */

import { renderHook, act } from "@testing-library/react";
import { useArticle } from "./useArticle";

// Mock parseArticle
jest.mock("../utils/parser", () => ({
  parseArticle: jest.fn(),
}));

// Mock logger
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { parseArticle } from "../utils/parser";

const mockParseArticle = parseArticle as jest.MockedFunction<typeof parseArticle>;

describe("useArticle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractArticle", () => {
    it("returns article data on successful extraction", async () => {
      const mockArticle = {
        title: "Test Article",
        content: "<p>Article content</p>",
        textContent: "Article content",
        length: 100,
        excerpt: "Article excerpt",
        byline: "Author Name",
        siteName: "Test Site",
        language: "en",
      };

      mockParseArticle.mockResolvedValue(mockArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article).toEqual(mockArticle);
      expect(mockParseArticle).toHaveBeenCalled();
    });

    it("returns null when extraction fails", async () => {
      mockParseArticle.mockResolvedValue(null);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article).toBeNull();
    });

    it("returns null when article has no content", async () => {
      const mockArticle = {
        title: "Test Article",
        content: "", // Empty content
        textContent: "",
        length: 0,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "en",
      };

      mockParseArticle.mockResolvedValue(mockArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article).toBeNull();
    });

    it("handles parser errors gracefully", async () => {
      mockParseArticle.mockRejectedValue(new Error("Parse error"));

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article).toBeNull();
    });

    it("can be called multiple times", async () => {
      const mockArticle1 = {
        title: "First Article",
        content: "<p>First content</p>",
        textContent: "First content",
        length: 50,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "en",
      };

      const mockArticle2 = {
        title: "Second Article",
        content: "<p>Second content</p>",
        textContent: "Second content",
        length: 60,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "en",
      };

      mockParseArticle
        .mockResolvedValueOnce(mockArticle1)
        .mockResolvedValueOnce(mockArticle2);

      const { result } = renderHook(() => useArticle());

      let article1, article2;
      await act(async () => {
        article1 = await result.current.extractArticle();
        article2 = await result.current.extractArticle();
      });

      expect(article1?.title).toBe("First Article");
      expect(article2?.title).toBe("Second Article");
      expect(mockParseArticle).toHaveBeenCalledTimes(2);
    });
  });

  describe("Hook stability", () => {
    it("extractArticle function is stable between renders", () => {
      const { result, rerender } = renderHook(() => useArticle());

      const extractFn1 = result.current.extractArticle;
      rerender();
      const extractFn2 = result.current.extractArticle;

      expect(extractFn1).toBe(extractFn2);
    });
  });

  describe("Article data structure", () => {
    it("handles article with all optional fields", async () => {
      const fullArticle = {
        title: "Full Article",
        content: "<p>Content</p>",
        textContent: "Content",
        length: 100,
        excerpt: "Article excerpt here",
        byline: "John Doe",
        siteName: "Example Site",
        language: "en",
        publishedTime: "2024-01-15T10:00:00Z",
        dir: "ltr",
      };

      mockParseArticle.mockResolvedValue(fullArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article?.byline).toBe("John Doe");
      expect(article?.siteName).toBe("Example Site");
      expect(article?.excerpt).toBe("Article excerpt here");
    });

    it("handles article with minimal fields", async () => {
      const minimalArticle = {
        title: "Minimal",
        content: "<p>Just content</p>",
        textContent: "Just content",
        length: 12,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "en",
      };

      mockParseArticle.mockResolvedValue(minimalArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article?.title).toBe("Minimal");
      expect(article?.byline).toBeNull();
    });
  });

  describe("Language detection", () => {
    it("handles English content", async () => {
      const englishArticle = {
        title: "English Article",
        content: "<p>This is English content</p>",
        textContent: "This is English content",
        length: 100,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "en",
      };

      mockParseArticle.mockResolvedValue(englishArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article?.language).toBe("en");
    });

    it("handles Chinese content", async () => {
      const chineseArticle = {
        title: "中文文章",
        content: "<p>这是中文内容</p>",
        textContent: "这是中文内容",
        length: 100,
        excerpt: "",
        byline: null,
        siteName: null,
        language: "zh",
      };

      mockParseArticle.mockResolvedValue(chineseArticle);

      const { result } = renderHook(() => useArticle());

      let article;
      await act(async () => {
        article = await result.current.extractArticle();
      });

      expect(article?.language).toBe("zh");
    });
  });
});
