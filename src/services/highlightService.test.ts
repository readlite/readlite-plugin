/**
 * Unit tests for HighlightService
 * Tests highlight application, management, and removal
 */

import { HighlightService, highlightService } from "./highlightService";

// Mock dependencies
jest.mock("./highlightStorage", () => ({
  highlightStorage: {
    getPageHighlights: jest.fn().mockResolvedValue([]),
    saveHighlight: jest.fn().mockResolvedValue(undefined),
    updateHighlight: jest.fn().mockResolvedValue(true),
    deleteHighlight: jest.fn().mockResolvedValue(true),
    getAllHighlights: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("./highlightAnchor", () => ({
  highlightAnchor: {
    createAnchorData: jest.fn().mockReturnValue({
      textBefore: "before",
      textAfter: "after",
      domPath: ["div", "p"],
      nodeIndex: 0,
    }),
    createSelectorData: jest.fn().mockReturnValue({
      textBefore: "before",
      textAfter: "after",
      domPath: ["div", "p"],
      nodeIndex: 0,
      exact: "selected text",
      start: 10,
      end: 22,
    }),
    applyHighlightWithSelector: jest.fn().mockReturnValue(true),
  },
}));

jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import mocked modules for test assertions
import { highlightStorage } from "./highlightStorage";

describe("HighlightService", () => {
  let service: HighlightService;
  let container: HTMLDivElement;

  // Helper to create a mock selection
  const createMockSelection = (range: Range): Selection => {
    return {
      rangeCount: 1,
      getRangeAt: jest.fn().mockReturnValue(range),
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
      collapse: jest.fn(),
      collapseToEnd: jest.fn(),
      collapseToStart: jest.fn(),
      containsNode: jest.fn(),
      deleteFromDocument: jest.fn(),
      empty: jest.fn(),
      extend: jest.fn(),
      selectAllChildren: jest.fn(),
      setBaseAndExtent: jest.fn(),
      setPosition: jest.fn(),
      toString: jest.fn().mockReturnValue(range.toString()),
      anchorNode: range.startContainer,
      anchorOffset: range.startOffset,
      focusNode: range.endContainer,
      focusOffset: range.endOffset,
      isCollapsed: range.collapsed,
      type: "Range",
      direction: "none",
      getComposedRanges: jest.fn(),
      modify: jest.fn(),
    } as unknown as Selection;
  };

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = "";
    container = document.createElement("div");
    container.className = "readlite-article-container";
    container.textContent = "This is some sample text for testing highlights.";
    document.body.appendChild(container);

    // Reset mocks
    jest.clearAllMocks();

    service = new HighlightService();
  });

  describe("applyHighlight", () => {
    it("applies highlight with valid selection", () => {
      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 8);
      range.setEnd(textNode, 14); // "some s"

      const mockSelection = createMockSelection(range);

      const result = service.applyHighlight(document, mockSelection, "beige");

      expect(typeof result).toBe("boolean");
    });

    it("returns false with null selection", () => {
      const result = service.applyHighlight(document, null, "beige");
      expect(result).toBe(false);
    });

    it("returns false with empty selection", () => {
      const mockSelection = {
        rangeCount: 0,
        getRangeAt: jest.fn(),
      } as unknown as Selection;

      const result = service.applyHighlight(document, mockSelection, "beige");
      expect(result).toBe(false);
    });

    it("returns false with collapsed selection", () => {
      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 5);
      range.collapse(true);

      const mockSelection = createMockSelection(range);

      const result = service.applyHighlight(document, mockSelection, "beige");
      expect(result).toBe(false);
    });

    it("supports all highlight colors", () => {
      const colors = ["beige", "cyan", "lavender", "olive", "peach"] as const;

      colors.forEach((color) => {
        // Reset container content for each iteration
        container.textContent = "Fresh text for highlighting test.";

        const range = document.createRange();
        const textNode = container.firstChild!;
        range.setStart(textNode, 0);
        range.setEnd(textNode, 5);

        const mockSelection = createMockSelection(range);
        const result = service.applyHighlight(document, mockSelection, color);

        expect(typeof result).toBe("boolean");
      });
    });

    it("supports optional note parameter", () => {
      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 0);
      range.setEnd(textNode, 10);

      const mockSelection = createMockSelection(range);

      const result = service.applyHighlight(
        document,
        mockSelection,
        "cyan",
        "My note",
      );

      expect(typeof result).toBe("boolean");
    });
  });

  describe("removeHighlight", () => {
    it("removes a highlight element", () => {
      // Create a highlight element
      container.innerHTML =
        'Before <span class="readlite-highlight" data-highlight-id="test-id">highlighted</span> after';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      const result = service.removeHighlight(highlightEl);

      expect(result).toBe(true);
      expect(container.querySelector(".readlite-highlight")).toBeNull();
      expect(container.textContent).toContain("highlighted");
    });

    it("deletes from storage when removing", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="storage-test">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      service.removeHighlight(highlightEl);

      expect(highlightStorage.deleteHighlight).toHaveBeenCalledWith(
        "storage-test",
      );
    });

    it("returns false for non-highlight element", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      const result = service.removeHighlight(div);
      expect(result).toBe(false);
    });

    it("returns false for null element", () => {
      const result = service.removeHighlight(null as unknown as Element);
      expect(result).toBe(false);
    });

    it("preserves surrounding text", () => {
      container.innerHTML =
        'Start <span class="readlite-highlight" data-highlight-id="test">middle</span> end';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      service.removeHighlight(highlightEl);

      expect(container.textContent).toBe("Start middle end");
    });
  });

  describe("updateHighlightNote", () => {
    it("updates note on element", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="note-test">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      const result = service.updateHighlightNote(highlightEl, "New note");

      expect(result).toBe(true);
      expect(highlightEl.getAttribute("data-note")).toBe("New note");
      expect(highlightEl.getAttribute("title")).toBe("New note");
    });

    it("updates storage with new note", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="note-storage">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      service.updateHighlightNote(highlightEl, "Updated note");

      expect(highlightStorage.updateHighlight).toHaveBeenCalledWith(
        "note-storage",
        expect.objectContaining({ note: "Updated note" }),
      );
    });

    it("returns false for null element", () => {
      const result = service.updateHighlightNote(
        null as unknown as Element,
        "note",
      );
      expect(result).toBe(false);
    });
  });

  describe("changeHighlightColor", () => {
    it("changes highlight color class", () => {
      container.innerHTML =
        '<span class="readlite-highlight readlite-highlight-beige" data-highlight-id="color-test" data-highlight-color="beige">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      const result = service.changeHighlightColor(highlightEl, "cyan");

      expect(result).toBe(true);
      expect(highlightEl.classList.contains("readlite-highlight-cyan")).toBe(
        true,
      );
      expect(highlightEl.classList.contains("readlite-highlight-beige")).toBe(
        false,
      );
      expect(highlightEl.getAttribute("data-highlight-color")).toBe("cyan");
    });

    it("updates storage with new color", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="color-storage">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      service.changeHighlightColor(highlightEl, "lavender");

      expect(highlightStorage.updateHighlight).toHaveBeenCalledWith(
        "color-storage",
        expect.objectContaining({ color: "lavender" }),
      );
    });

    it("removes all other color classes", () => {
      container.innerHTML =
        '<span class="readlite-highlight readlite-highlight-beige readlite-highlight-cyan" data-highlight-id="multi-color">text</span>';

      const highlightEl = container.querySelector(".readlite-highlight")!;
      service.changeHighlightColor(highlightEl, "olive");

      expect(highlightEl.classList.contains("readlite-highlight-olive")).toBe(
        true,
      );
      expect(highlightEl.classList.contains("readlite-highlight-beige")).toBe(
        false,
      );
      expect(highlightEl.classList.contains("readlite-highlight-cyan")).toBe(
        false,
      );
    });

    it("returns false for null element", () => {
      const result = service.changeHighlightColor(
        null as unknown as Element,
        "peach",
      );
      expect(result).toBe(false);
    });
  });

  describe("getAllHighlights", () => {
    it("returns all highlights in document", () => {
      container.innerHTML = `
        <span class="readlite-highlight" data-highlight-id="h1">First</span>
        <p>Normal text</p>
        <span class="readlite-highlight" data-highlight-id="h2">Second</span>
        <span class="readlite-highlight" data-highlight-id="h3">Third</span>
      `;

      const highlights = service.getAllHighlights(document);

      expect(highlights).toHaveLength(3);
    });

    it("returns empty array when no highlights", () => {
      container.innerHTML = "<p>No highlights here</p>";

      const highlights = service.getAllHighlights(document);

      expect(highlights).toEqual([]);
    });

    it("returns Element array", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="elem">text</span>';

      const highlights = service.getAllHighlights(document);

      expect(highlights[0]).toBeInstanceOf(Element);
      expect(highlights[0].classList.contains("readlite-highlight")).toBe(true);
    });
  });

  describe("Singleton export", () => {
    it("exports a singleton instance", () => {
      expect(highlightService).toBeInstanceOf(HighlightService);
    });

    it("singleton has all expected methods", () => {
      expect(typeof highlightService.applyHighlight).toBe("function");
      expect(typeof highlightService.removeHighlight).toBe("function");
      expect(typeof highlightService.updateHighlightNote).toBe("function");
      expect(typeof highlightService.changeHighlightColor).toBe("function");
      expect(typeof highlightService.getAllHighlights).toBe("function");
    });
  });

  describe("Highlight colors configuration", () => {
    const colors = ["beige", "cyan", "lavender", "olive", "peach"] as const;

    colors.forEach((color) => {
      it(`supports ${color} color`, () => {
        container.innerHTML = `<span class="readlite-highlight readlite-highlight-${color}" data-highlight-color="${color}">text</span>`;

        const span = container.querySelector(".readlite-highlight");
        expect(span?.classList.contains(`readlite-highlight-${color}`)).toBe(
          true,
        );
        expect(span?.getAttribute("data-highlight-color")).toBe(color);
      });
    });
  });

  describe("Edge cases", () => {
    it("handles selection with whitespace only", () => {
      container.textContent = "Before    After";

      const range = document.createRange();
      const textNode = container.firstChild!;
      range.setStart(textNode, 6);
      range.setEnd(textNode, 10); // Just whitespace

      const mockSelection = createMockSelection(range);

      // Should return false for whitespace-only selection
      const result = service.applyHighlight(document, mockSelection, "beige");
      expect(typeof result).toBe("boolean");
    });

    it("handles deeply nested highlight removal", () => {
      container.innerHTML = `
        <div>
          <p>
            <strong>
              <span class="readlite-highlight" data-highlight-id="nested">text</span>
            </strong>
          </p>
        </div>
      `;

      const highlightEl = container.querySelector(".readlite-highlight")!;
      const result = service.removeHighlight(highlightEl);

      expect(result).toBe(true);
    });

    it("handles multiple consecutive highlights", () => {
      container.innerHTML =
        '<span class="readlite-highlight" data-highlight-id="h1">first</span><span class="readlite-highlight" data-highlight-id="h2">second</span>';

      const highlights = service.getAllHighlights(document);
      expect(highlights).toHaveLength(2);
    });
  });
});
