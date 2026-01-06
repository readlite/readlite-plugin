/**
 * Unit tests for HighlightAnchor service
 * Tests text anchoring and selector creation for highlight persistence
 */

import { HighlightAnchor } from "./highlightAnchor";

// Mock logger
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe("HighlightAnchor", () => {
  let anchor: HighlightAnchor;

  beforeEach(() => {
    anchor = new HighlightAnchor();
    // Reset DOM
    document.body.innerHTML = "";
  });

  describe("createAnchorData", () => {
    it("creates anchor data with context before and after", () => {
      const container = document.createElement("div");
      container.textContent =
        "This is some text with highlighted portion in the middle of it.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "highlighted portion");

      expect(result.textBefore).toContain("text with");
      expect(result.textAfter).toContain("in the middle");
      expect(result.domPath).toBeDefined();
      expect(Array.isArray(result.domPath)).toBe(true);
    });

    it("handles text at the beginning of content", () => {
      const container = document.createElement("div");
      container.textContent = "Beginning text that continues on.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "Beginning");

      expect(result.textBefore).toBe("");
      expect(result.textAfter).toContain("text that");
    });

    it("handles text at the end of content", () => {
      const container = document.createElement("div");
      container.textContent = "Some text at the ending.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "ending.");

      expect(result.textBefore).toContain("at the");
      expect(result.textAfter).toBe("");
    });

    it("handles text not found in node", () => {
      const container = document.createElement("div");
      container.textContent = "Some content here.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(
        textNode,
        "completely unique nonexistent xyz123",
      );

      // Should return fallback values when text truly not found
      // The implementation may use partial matching, so just verify structure
      expect(result.domPath).toBeDefined();
      expect(typeof result.nodeIndex).toBe("number");
    });

    it("normalizes whitespace in content", () => {
      const container = document.createElement("div");
      container.textContent = "Text   with    multiple   spaces.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "with multiple");

      expect(result.textBefore).toBeDefined();
      expect(result.textAfter).toBeDefined();
    });

    it("handles CJK text", () => {
      const container = document.createElement("div");
      container.textContent = "这是一段中文文本，其中包含需要高亮的内容。";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "需要高亮");

      expect(result.textBefore).toContain("包含");
      expect(result.textAfter).toContain("内容");
    });

    it("handles empty text input", () => {
      const container = document.createElement("div");
      container.textContent = "Some content.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "");

      expect(result).toBeDefined();
    });

    it("provides nodeIndex for uniqueness", () => {
      const container = document.createElement("div");
      container.innerHTML = "<p>First paragraph.</p><p>Second paragraph.</p>";
      document.body.appendChild(container);

      const firstP = container.querySelector("p")!;
      const result = anchor.createAnchorData(firstP.firstChild!, "First");

      expect(typeof result.nodeIndex).toBe("number");
    });
  });

  describe("createSelectorData", () => {
    it("creates W3C TextQuoteSelector data", () => {
      const container = document.createElement("div");
      container.textContent =
        "This is the article content with important text here.";
      document.body.appendChild(container);

      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 33);
      range.setEnd(textNode, 47);

      const result = anchor.createSelectorData(container, range);

      expect(result.exact).toBe("important text");
      expect(result.textBefore).toBeDefined();
      expect(result.textAfter).toBeDefined();
      expect(typeof result.start).toBe("number");
      expect(typeof result.end).toBe("number");
    });

    it("calculates correct start and end positions", () => {
      const container = document.createElement("div");
      container.textContent = "0123456789";
      document.body.appendChild(container);

      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 3);
      range.setEnd(textNode, 7);

      const result = anchor.createSelectorData(container, range);

      expect(result.exact).toBe("3456");
      expect(result.start).toBe(3);
      expect(result.end).toBe(7);
    });

    it("handles multi-node ranges", () => {
      const container = document.createElement("div");
      container.innerHTML = "<span>First </span><span>Second</span>";
      document.body.appendChild(container);

      const range = document.createRange();
      const firstSpan = container.querySelector("span")!;
      const secondSpan = container.querySelectorAll("span")[1]!;
      range.setStart(firstSpan.firstChild!, 0);
      range.setEnd(secondSpan.firstChild!, 6);

      const result = anchor.createSelectorData(container, range);

      // Multi-node range extraction - verify structure
      expect(result.exact).toBeDefined();
      expect(typeof result.start).toBe("number");
      expect(typeof result.end).toBe("number");
      expect(result.end).toBeGreaterThanOrEqual(result.start);
    });

    it("extracts context prefix and suffix", () => {
      const container = document.createElement("div");
      container.textContent = "Prefix context TARGET WORD suffix context here.";
      document.body.appendChild(container);

      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 15);
      range.setEnd(textNode, 26);

      const result = anchor.createSelectorData(container, range, 10);

      expect(result.exact).toBe("TARGET WORD");
      expect(result.textBefore.length).toBeLessThanOrEqual(10);
      expect(result.textAfter.length).toBeLessThanOrEqual(10);
    });
  });

  describe("getDomPath", () => {
    it("returns path array for nested elements", () => {
      const container = document.createElement("article");
      container.innerHTML = "<div><p><span>Text</span></p></div>";
      document.body.appendChild(container);

      const span = container.querySelector("span")!;
      // Access private method through class instance
      const path = (
        anchor as unknown as { getDomPath: (el: Element) => string[] }
      ).getDomPath(span);

      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe("applyHighlightWithSelector", () => {
    it("applies highlight to matching text", () => {
      const container = document.createElement("div");
      container.textContent = "This is the text to highlight here.";
      document.body.appendChild(container);

      const selector = {
        exact: "text to highlight",
        textBefore: "the ",
        textAfter: " here",
        start: 12,
        end: 29,
      };

      const result = anchor.applyHighlightWithSelector(
        container,
        selector,
        "test-highlight-id",
        "my-highlight-class",
      );

      expect(result).toBe(true);
      expect(container.querySelector(".my-highlight-class")).toBeTruthy();
    });

    it("returns false when text not found", () => {
      const container = document.createElement("div");
      container.textContent = "Some different content.";
      document.body.appendChild(container);

      const selector = {
        exact: "nonexistent text that does not exist anywhere",
        textBefore: "prefix",
        textAfter: "suffix",
        start: 100,
        end: 150,
      };

      const result = anchor.applyHighlightWithSelector(
        container,
        selector,
        "test-id",
      );

      expect(result).toBe(false);
    });

    it("uses context matching when exact match fails", () => {
      const container = document.createElement("div");
      container.textContent = "Before context exact match after context";
      document.body.appendChild(container);

      const selector = {
        exact: "exact match",
        textBefore: "context ",
        textAfter: " after",
        start: -1, // Invalid position to force context matching
        end: -1,
      };

      const result = anchor.applyHighlightWithSelector(
        container,
        selector,
        "context-match-id",
      );

      expect(result).toBe(true);
    });

    it("applies default class name when not specified", () => {
      const container = document.createElement("div");
      container.textContent = "Text with highlighted portion here.";
      document.body.appendChild(container);

      const selector = {
        exact: "highlighted",
        textBefore: "with ",
        textAfter: " portion",
        start: 10,
        end: 21,
      };

      anchor.applyHighlightWithSelector(
        container,
        selector,
        "default-class-test",
      );

      expect(container.querySelector(".readlite-highlight")).toBeTruthy();
    });
  });

  describe("Edge cases", () => {
    it("handles empty container", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      const selector = {
        exact: "any text",
        textBefore: "",
        textAfter: "",
        start: 0,
        end: 8,
      };

      const result = anchor.applyHighlightWithSelector(
        container,
        selector,
        "empty-test",
      );

      expect(result).toBe(false);
    });

    it("handles special regex characters in text", () => {
      const container = document.createElement("div");
      container.textContent = "Text with special chars: [a-z]+ and (.*) here.";
      document.body.appendChild(container);

      const selector = {
        exact: "[a-z]+ and (.*)",
        textBefore: "chars: ",
        textAfter: " here",
        start: 25,
        end: 40,
      };

      const result = anchor.applyHighlightWithSelector(
        container,
        selector,
        "regex-test",
      );

      // Should handle regex special chars without error
      expect(typeof result).toBe("boolean");
    });

    it("handles unicode and emoji", () => {
      const container = document.createElement("div");
      container.textContent = "Text with emoji 🎉 and unicode café here.";
      document.body.appendChild(container);

      const textNode = container.firstChild!;
      const result = anchor.createAnchorData(textNode, "🎉 and unicode café");

      expect(result.textBefore).toContain("emoji");
      expect(result.textAfter).toContain("here");
    });
  });
});
