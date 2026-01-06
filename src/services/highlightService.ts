/**
 * Highlight Service
 * Centralized service for applying, managing, and restoring highlights
 * Refactored from useTextSelection hook to reduce complexity
 */

import { highlightStorage } from "./highlightStorage";
import { highlightAnchor } from "./highlightAnchor";
import { createLogger } from "~/utils/logger";

const logger = createLogger("highlight-service");

export type HighlightColor = "beige" | "cyan" | "lavender" | "olive" | "peach";

// Color configuration
const HIGHLIGHT_COLORS = {
  beige: {
    background: "rgba(255,245,230,0.82)",
    solid: "#fff5e6",
  },
  cyan: {
    background: "rgba(181,228,255,0.82)",
    solid: "#b5e4ff",
  },
  lavender: {
    background: "rgba(220,198,255,0.82)",
    solid: "#dcc6ff",
  },
  olive: {
    background: "rgba(222,234,181,0.82)",
    solid: "#deeab5",
  },
  peach: {
    background: "rgba(255,204,153,0.82)",
    solid: "#ffcc99",
  },
};

/**
 * Strategy interface for different highlighting approaches
 */
interface HighlightStrategy {
  name: string;
  apply(
    doc: Document,
    range: Range,
    selection: Selection | null,
    color: HighlightColor,
    note?: string,
  ): boolean;
}

/**
 * Helper to generate unique highlight IDs
 */
const generateHighlightId = (): string => {
  return `highlight-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

/**
 * Helper to find all text nodes within a range
 */
const getAllTextNodesInRange = (range: Range, doc: Document): Text[] => {
  const container = range.commonAncestorContainer;

  const nodeInRange = (node: Node): boolean => {
    if (node.nodeType !== Node.TEXT_NODE) return false;

    const nodeRange = doc.createRange();
    nodeRange.selectNodeContents(node);

    return (
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
    );
  };

  const collectTextNodes = (node: Node, textNodes: Text[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (nodeInRange(node) && node.textContent && node.textContent.trim()) {
        textNodes.push(node as Text);
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        collectTextNodes(node.childNodes[i], textNodes);
      }
    }
  };

  const textNodes: Text[] = [];
  collectTextNodes(container, textNodes);
  return textNodes;
};

/**
 * Helper to find article container for consistent anchoring
 */
const findArticleContainer = (element: Node): Element | null => {
  let current =
    element.nodeType === Node.TEXT_NODE
      ? element.parentElement
      : (element as Element);

  while (current && current !== document.body) {
    if (
      current.tagName === "ARTICLE" ||
      current.classList.contains("article") ||
      current.classList.contains("content") ||
      current.classList.contains("article-content") ||
      current.classList.contains("post-content") ||
      current.classList.contains("readlite-reader-container") ||
      current.classList.contains("readlite-article-container") ||
      current.id === "article" ||
      current.id === "content" ||
      current.getAttribute("role") === "main"
    ) {
      logger.info(`Found article container: ${current.tagName}`);
      return current;
    }
    current = current.parentElement as Element;
  }
  return null;
};

/**
 * Save highlight to storage
 */
const saveHighlightToStorage = (
  highlightId: string,
  firstNode: Node,
  highlightText: string,
  color: HighlightColor,
  note?: string,
) => {
  const articleContainer = findArticleContainer(firstNode);
  if (articleContainer) {
    articleContainer.classList.add("readlite-article-container");
  }

  const anchorData = highlightAnchor.createAnchorData(firstNode, highlightText);

  highlightStorage.saveHighlight({
    id: highlightId,
    url: window.location.href,
    text: highlightText,
    color,
    note,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    textBefore: anchorData.textBefore,
    textAfter: anchorData.textAfter,
    domPath: anchorData.domPath,
    nodeIndex: anchorData.nodeIndex,
  });

  logger.info(`Saved highlight to storage: ${highlightId}`);
};

/**
 * Create a highlight span element
 */
const createHighlightSpan = (
  doc: Document,
  color: HighlightColor,
  highlightId: string,
  note?: string,
): HTMLSpanElement => {
  const span = doc.createElement("span");
  span.className = `readlite-highlight readlite-highlight-${color}`;
  span.dataset.highlightColor = color;
  span.dataset.highlightId = highlightId;
  span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

  if (note) {
    span.dataset.note = note;
    span.title = note;
  }

  return span;
};

/**
 * Strategy 1: DOM Manipulation (most reliable for simple selections)
 */
class DomManipulationStrategy implements HighlightStrategy {
  name = "DomManipulation";

  apply(
    doc: Document,
    range: Range,
    selection: Selection | null,
    color: HighlightColor,
    note?: string,
  ): boolean {
    try {
      const highlightId = generateHighlightId();
      const highlightText = range.toString().trim();

      logger.info(`Applying ${this.name} strategy`);

      // Simple case: entirely within a single text node
      if (
        range.startContainer === range.endContainer &&
        range.startContainer.nodeType === Node.TEXT_NODE
      ) {
        const highlightSpan = createHighlightSpan(doc, color, highlightId, note);
        range.surroundContents(highlightSpan);

        saveHighlightToStorage(
          highlightId,
          range.startContainer,
          highlightText,
          color,
          note,
        );

        return true;
      }

      // Complex case: multiple nodes
      const nodes = getAllTextNodesInRange(range, doc);
      if (nodes.length === 0) {
        return false;
      }

      const firstNode = nodes[0];

      // Process nodes in reverse to avoid changing positions
      nodes.reverse().forEach((textNode) => {
        const nodeRange = doc.createRange();
        const isStartNode = textNode === range.startContainer;
        const isEndNode = textNode === range.endContainer;

        nodeRange.setStart(textNode, isStartNode ? range.startOffset : 0);
        nodeRange.setEnd(
          textNode,
          isEndNode ? range.endOffset : textNode.length,
        );

        if (nodeRange.toString().trim()) {
          const spanForNode = createHighlightSpan(doc, color, highlightId, note);
          try {
            const content = nodeRange.extractContents();
            spanForNode.appendChild(content);
            nodeRange.insertNode(spanForNode);
          } catch (e) {
            logger.warn("Failed to extract contents, using alternative", e);
          }
        }
      });

      saveHighlightToStorage(highlightId, firstNode, highlightText, color, note);
      return true;
    } catch (error) {
      logger.error(`${this.name} strategy failed:`, error);
      return false;
    }
  }
}

/**
 * Strategy 2: Text Node Level (best for complex formatted text)
 */
class TextNodeStrategy implements HighlightStrategy {
  name = "TextNode";

  apply(
    doc: Document,
    range: Range,
    selection: Selection | null,
    color: HighlightColor,
    note?: string,
  ): boolean {
    try {
      const highlightId = generateHighlightId();
      const highlightText = range.toString().trim();

      logger.info(`Applying ${this.name} strategy`);

      if (!highlightText) return false;

      const textNodes = getAllTextNodesInRange(range, doc);
      if (textNodes.length === 0) return false;

      const firstNode = textNodes[0];

      textNodes.forEach((textNode, index) => {
        let startOffset = 0;
        let endOffset = textNode.textContent?.length || 0;

        if (index === 0 && textNode === range.startContainer) {
          startOffset = range.startOffset;
        }
        if (
          index === textNodes.length - 1 &&
          textNode === range.endContainer
        ) {
          endOffset = range.endOffset;
        }

        if (startOffset >= endOffset) return;

        try {
          const nodeRange = doc.createRange();
          nodeRange.setStart(textNode, startOffset);
          nodeRange.setEnd(textNode, endOffset);

          const text = nodeRange.toString();
          if (!text.trim()) return;

          // Split text node and wrap highlight
          if (startOffset > 0) {
            const beforeText = textNode.textContent!.substring(0, startOffset);
            const beforeNode = doc.createTextNode(beforeText);
            textNode.parentNode?.insertBefore(beforeNode, textNode);
          }

          const highlightSpan = createHighlightSpan(doc, color, highlightId, note);
          highlightSpan.textContent = text;
          textNode.parentNode?.insertBefore(highlightSpan, textNode);

          if (endOffset < textNode.textContent!.length) {
            const afterText = textNode.textContent!.substring(endOffset);
            const afterNode = doc.createTextNode(afterText);
            textNode.parentNode?.insertBefore(afterNode, textNode);
          }

          textNode.parentNode?.removeChild(textNode);
        } catch (e) {
          logger.error(`Error highlighting text node:`, e);
        }
      });

      saveHighlightToStorage(highlightId, firstNode, highlightText, color, note);
      return true;
    } catch (error) {
      logger.error(`${this.name} strategy failed:`, error);
      return false;
    }
  }
}

/**
 * Strategy 3: execCommand (fallback for browser compatibility)
 */
class ExecCommandStrategy implements HighlightStrategy {
  name = "ExecCommand";

  apply(
    doc: Document,
    range: Range,
    selection: Selection | null,
    color: HighlightColor,
    note?: string,
  ): boolean {
    try {
      if (!selection || selection.rangeCount === 0) return false;

      const highlightId = generateHighlightId();
      const highlightText = selection.toString().trim();
      const bgColor = HIGHLIGHT_COLORS[color].background;

      logger.info(`Applying ${this.name} strategy`);

      doc.execCommand("hiliteColor", false, bgColor);

      // Find and tag highlighted elements
      setTimeout(() => {
        const container =
          range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : (range.commonAncestorContainer as Element);

        if (!container) return;

        const elements = Array.from(
          container.querySelectorAll('[style*="background-color"]'),
        );

        const highlightedElements = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          return style.backgroundColor === bgColor;
        });

        if (highlightedElements.length > 0) {
          highlightedElements.forEach((el) => {
            el.classList.add("readlite-highlight", `readlite-highlight-${color}`);
            el.setAttribute("data-highlight-color", color);
            el.setAttribute("data-highlight-id", highlightId);
            if (note) {
              el.setAttribute("data-note", note);
              el.setAttribute("title", note);
            }
          });

          const firstElement = highlightedElements[0];
          saveHighlightToStorage(
            highlightId,
            firstElement,
            highlightText,
            color,
            note,
          );
        }
      }, 0);

      return true;
    } catch (error) {
      logger.error(`${this.name} strategy failed:`, error);
      return false;
    }
  }
}

/**
 * Main Highlight Service Class
 */
export class HighlightService {
  private strategies: HighlightStrategy[];

  constructor() {
    this.strategies = [
      new TextNodeStrategy(), // Best for complex formatted text
      new DomManipulationStrategy(), // Best for simple selections
      new ExecCommandStrategy(), // Fallback for compatibility
    ];
  }

  /**
   * Check if selection is complex (crosses elements or contains formatted text)
   */
  private isComplexSelection(range: Range): boolean {
    if (range.startContainer !== range.endContainer) {
      return true;
    }

    const container = range.commonAncestorContainer;
    if (container.nodeType === Node.ELEMENT_NODE) {
      const formattedTags = (container as Element).querySelectorAll(
        "b, strong, em, i, u, mark, code",
      );
      if (formattedTags.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Apply highlight using best available strategy
   */
  applyHighlight(
    doc: Document,
    selection: Selection | null,
    color: HighlightColor,
    note?: string,
  ): boolean {
    if (!selection || selection.rangeCount === 0) {
      logger.warn("No selection available");
      return false;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      logger.warn("Selection is collapsed");
      return false;
    }

    const text = range.toString().trim();
    if (!text) {
      logger.warn("Selection contains no text");
      return false;
    }

    const isComplex = this.isComplexSelection(range);
    logger.info(`Selection complexity: ${isComplex ? "complex" : "simple"}`);

    // Try strategies in order
    for (const strategy of this.strategies) {
      const clonedRange = range.cloneRange();
      if (strategy.apply(doc, clonedRange, selection, color, note)) {
        logger.info(`Successfully applied highlight using ${strategy.name}`);
        return true;
      }
    }

    logger.error("All highlighting strategies failed");
    return false;
  }

  /**
   * Remove highlight from element
   */
  removeHighlight(element: Element): boolean {
    if (!element || !element.parentNode) {
      logger.error("Invalid element for removal");
      return false;
    }

    try {
      if (!element.classList.contains("readlite-highlight")) {
        logger.warn("Element is not a highlight");
        return false;
      }

      const highlightId = element.getAttribute("data-highlight-id");
      const doc = element.ownerDocument || document;
      const fragment = doc.createDocumentFragment();

      while (element.firstChild) {
        fragment.appendChild(element.firstChild);
      }

      element.parentNode.replaceChild(fragment, element);

      if (highlightId) {
        highlightStorage.deleteHighlight(highlightId);
      }

      logger.info("Successfully removed highlight");
      return true;
    } catch (error) {
      logger.error("Failed to remove highlight:", error);
      return false;
    }
  }

  /**
   * Update highlight note
   */
  updateHighlightNote(element: Element, note: string): boolean {
    if (!element) return false;

    try {
      element.setAttribute("data-note", note);
      element.setAttribute("title", note);

      const highlightId = element.getAttribute("data-highlight-id");
      if (highlightId) {
        highlightStorage.updateHighlight(highlightId, {
          note,
          updatedAt: Date.now(),
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to update highlight note:", error);
      return false;
    }
  }

  /**
   * Change highlight color
   */
  changeHighlightColor(element: Element, color: HighlightColor): boolean {
    if (!element) return false;

    try {
      // Remove all color classes
      Object.keys(HIGHLIGHT_COLORS).forEach((c) => {
        element.classList.remove(`readlite-highlight-${c}`);
      });

      // Add new color class
      element.classList.add(`readlite-highlight-${color}`);
      element.setAttribute("data-highlight-color", color);

      const highlightId = element.getAttribute("data-highlight-id");
      if (highlightId) {
        highlightStorage.updateHighlight(highlightId, {
          color,
          updatedAt: Date.now(),
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to change highlight color:", error);
      return false;
    }
  }

  /**
   * Get all highlights in document
   */
  getAllHighlights(doc: Document): Element[] {
    try {
      const highlights = doc.querySelectorAll(".readlite-highlight");
      return Array.from(highlights);
    } catch (error) {
      logger.error("Failed to get highlights:", error);
      return [];
    }
  }
}

// Export singleton instance
export const highlightService = new HighlightService();
