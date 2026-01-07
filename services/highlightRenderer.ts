/**
 * Highlight Renderer Service
 * Handles all DOM manipulation for highlights: creating, styling, and removing highlight spans
 * 
 * This is a pure service with no React dependencies - can be used anywhere
 */

import { createLogger } from "../utils/logger";
import { highlightAnchor } from "./highlightAnchor";
import { highlightStorage } from "./highlightStorage";

const logger = createLogger("highlight-renderer");

// Highlight color type - 3 essential colors
export type HighlightColor = "yellow" | "blue" | "purple";

// Color configuration
export const HIGHLIGHT_COLORS: Record<HighlightColor, { background: string; solid: string }> = {
  yellow: {
    background: "rgba(255,245,200,0.85)",
    solid: "#fff5c8",
  },
  blue: {
    background: "rgba(181,228,255,0.85)",
    solid: "#b5e4ff",
  },
  purple: {
    background: "rgba(220,198,255,0.85)",
    solid: "#dcc6ff",
  },
};

/**
 * Generate a unique ID for each highlight
 */
export const generateHighlightId = (): string => {
  return `hl-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

/**
 * Ensure highlight styles are injected into the document
 */
export const ensureHighlightStyles = (doc: Document): void => {
  if (doc.getElementById("readlite-highlight-styles")) return;

  const style = doc.createElement("style");
  style.id = "readlite-highlight-styles";

  style.textContent = `
    .readlite-highlight {
      display: inline !important;
      white-space: inherit !important;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      border-radius: 2px;
      padding: 1px 0;
      margin: 0 -1px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      position: relative;
      text-decoration: none !important;
    }
    .readlite-highlight-yellow { background-color: ${HIGHLIGHT_COLORS.yellow.background} !important; }
    .readlite-highlight-blue { background-color: ${HIGHLIGHT_COLORS.blue.background} !important; }
    .readlite-highlight-purple { background-color: ${HIGHLIGHT_COLORS.purple.background} !important; }
  `;

  doc.head.appendChild(style);
};

/**
 * Create a highlight span element
 */
export const createHighlightSpan = (
  doc: Document,
  color: HighlightColor,
  highlightId: string,
  note?: string
): HTMLSpanElement => {
  const span = doc.createElement("span");
  span.className = `readlite-highlight readlite-highlight-${color}`;
  span.dataset.highlightColor = color;
  span.dataset.highlightId = highlightId;

  // Inline styles for maximum compatibility
  span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

  if (note) {
    span.dataset.note = note;
    span.title = note;
  }

  return span;
};

/**
 * Get all text nodes within a range
 */
export const getTextNodesInRange = (range: Range, doc: Document): Text[] => {
  const container = range.commonAncestorContainer;
  const textNodes: Text[] = [];

  const nodeInRange = (node: Node): boolean => {
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const nodeRange = doc.createRange();
    nodeRange.selectNodeContents(node);
    return (
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
    );
  };

  const collectTextNodes = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (nodeInRange(node) && node.textContent?.trim()) {
        textNodes.push(node as Text);
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        collectTextNodes(node.childNodes[i]);
      }
    }
  };

  collectTextNodes(container);
  return textNodes;
};

/**
 * Remove empty highlight spans from a container
 */
export const clearEmptyHighlightSpans = (container: Node): void => {
  if (container.nodeType !== Node.ELEMENT_NODE) return;
  
  const element = container as Element;
  const emptySpans = element.querySelectorAll("span.readlite-highlight:empty");
  emptySpans.forEach((span) => span.parentNode?.removeChild(span));

  // Also remove spans with only whitespace
  const spans = element.querySelectorAll("span.readlite-highlight");
  spans.forEach((span) => {
    if (!span.textContent?.trim()) {
      span.parentNode?.removeChild(span);
    }
  });
};

/**
 * Find article container for consistent anchoring
 */
export const findArticleContainer = (element: Node): Element | null => {
  let current = element.nodeType === Node.TEXT_NODE 
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
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

/**
 * Wrap a range with a highlight span (simple case - single text node)
 */
export const wrapRangeSimple = (
  doc: Document,
  range: Range,
  color: HighlightColor,
  highlightId: string,
  note?: string
): HTMLSpanElement | null => {
  try {
    const span = createHighlightSpan(doc, color, highlightId, note);
    range.surroundContents(span);
    return span;
  } catch (error) {
    logger.warn("Simple wrap failed:", error);
    return null;
  }
};

/**
 * Wrap multiple text nodes with highlight spans (complex case)
 */
export const wrapTextNodes = (
  doc: Document,
  textNodes: Text[],
  range: Range,
  color: HighlightColor,
  highlightId: string,
  note?: string
): boolean => {
  if (textNodes.length === 0) return false;

  try {
    // Process nodes in reverse to avoid position changes
    [...textNodes].reverse().forEach((textNode, index) => {
      const nodeRange = doc.createRange();
      const isStartNode = textNode === range.startContainer;
      const isEndNode = textNode === range.endContainer;

      nodeRange.setStart(textNode, isStartNode ? range.startOffset : 0);
      nodeRange.setEnd(textNode, isEndNode ? range.endOffset : textNode.length);

      const text = nodeRange.toString();
      if (!text.trim()) return;

      const span = createHighlightSpan(doc, color, highlightId, note);
      
      try {
        const content = nodeRange.extractContents();
        span.appendChild(content);
        nodeRange.insertNode(span);
      } catch (e) {
        // Fallback: create new text node
        const newTextNode = doc.createTextNode(text);
        span.appendChild(newTextNode);
        nodeRange.deleteContents();
        nodeRange.insertNode(span);
      }
    });

    clearEmptyHighlightSpans(range.commonAncestorContainer);
    return true;
  } catch (error) {
    logger.error("Text node wrapping failed:", error);
    return false;
  }
};

/**
 * Remove a highlight and restore original text
 */
export const removeHighlightSpan = (element: Element, doc: Document): boolean => {
  if (!element.classList.contains("readlite-highlight")) {
    return false;
  }

  try {
    const fragment = doc.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.parentNode?.replaceChild(fragment, element);
    return true;
  } catch (error) {
    logger.error("Failed to remove highlight:", error);
    return false;
  }
};

/**
 * Update highlight color
 */
export const updateHighlightColor = (element: Element, newColor: HighlightColor): boolean => {
  try {
    // Remove old color classes
    element.classList.remove(
      "readlite-highlight-yellow",
      "readlite-highlight-blue",
      "readlite-highlight-purple"
    );
    
    // Add new color class
    element.classList.add(`readlite-highlight-${newColor}`);
    element.setAttribute("data-highlight-color", newColor);
    
    // Update inline style
    (element as HTMLElement).style.backgroundColor = HIGHLIGHT_COLORS[newColor].background;
    
    return true;
  } catch (error) {
    logger.error("Failed to update highlight color:", error);
    return false;
  }
};

// Result type for applyHighlight
interface ApplyHighlightResult {
  success: boolean;
  highlightId?: string;
  anchorNode?: Node;
}

/**
 * Apply highlight to current selection - main entry point
 * Tries multiple strategies to handle various selection types
 */
export const applyHighlight = (
  doc: Document,
  selection: Selection,
  color: HighlightColor,
  note?: string
): ApplyHighlightResult => {
  if (!selection || selection.rangeCount === 0) {
    return { success: false };
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return { success: false };
  }

  const text = range.toString().trim();
  if (!text) {
    return { success: false };
  }

  const highlightId = generateHighlightId();
  
  // Check if simple or complex selection
  const isSimpleSelection = 
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE;

  let anchorNode: Node = range.startContainer;

  if (isSimpleSelection) {
    // Simple case: single text node
    const span = wrapRangeSimple(doc, range, color, highlightId, note);
    if (span) {
      anchorNode = span;
      return { success: true, highlightId, anchorNode };
    }
  }

  // Complex case: multiple nodes or elements
  const textNodes = getTextNodesInRange(range, doc);
  if (textNodes.length > 0) {
    const success = wrapTextNodes(doc, textNodes, range, color, highlightId, note);
    if (success) {
      anchorNode = textNodes[0];
      return { success: true, highlightId, anchorNode };
    }
  }

  // Fallback: try execCommand
  try {
    const bgColor = HIGHLIGHT_COLORS[color].background;
    doc.execCommand("hiliteColor", false, bgColor);
    
    // Find and update the created elements
    const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as Element);
    
    if (container) {
      const elements = Array.from(container.querySelectorAll('[style*="background-color"]'));
      elements.forEach((el) => {
        el.classList.add("readlite-highlight", `readlite-highlight-${color}`);
        el.setAttribute("data-highlight-color", color);
        el.setAttribute("data-highlight-id", highlightId);
        if (note) {
          el.setAttribute("data-note", note);
          el.setAttribute("title", note);
        }
      });
      
      if (elements.length > 0) {
        anchorNode = elements[0].firstChild || elements[0];
        return { success: true, highlightId, anchorNode };
      }
    }
  } catch (e) {
    logger.warn("execCommand fallback failed:", e);
  }

  return { success: false };
};

/**
 * Save highlight data to storage
 */
export const saveHighlightToStorage = async (
  highlightId: string,
  text: string,
  color: HighlightColor,
  anchorNode: Node,
  note?: string
): Promise<void> => {
  try {
    // Find article container for better anchoring
    const articleContainer = findArticleContainer(anchorNode);
    if (articleContainer) {
      articleContainer.classList.add("readlite-article-container");
    }

    // Create anchor data
    const anchorData = highlightAnchor.createAnchorData(anchorNode, text);

    // Save to storage
    await highlightStorage.saveHighlight({
      id: highlightId,
      url: window.location.href,
      text,
      color,
      note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      textBefore: anchorData.textBefore,
      textAfter: anchorData.textAfter,
      domPath: anchorData.domPath,
      nodeIndex: anchorData.nodeIndex,
    });

    logger.info(`Highlight saved: ${highlightId}`);
  } catch (error) {
    logger.error("Failed to save highlight to storage:", error);
    throw error;
  }
};

export const highlightRenderer = {
  generateHighlightId,
  ensureHighlightStyles,
  createHighlightSpan,
  getTextNodesInRange,
  clearEmptyHighlightSpans,
  findArticleContainer,
  wrapRangeSimple,
  wrapTextNodes,
  removeHighlightSpan,
  updateHighlightColor,
  applyHighlight,
  saveHighlightToStorage,
  HIGHLIGHT_COLORS,
};
