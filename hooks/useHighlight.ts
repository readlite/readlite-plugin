/**
 * useHighlight Hook
 * Handles highlight operations: apply, remove, update
 * 
 * This hook focuses on the business logic of highlighting,
 * delegating DOM operations to highlightRenderer service
 */

import { useCallback, RefObject } from "react";
import { 
  HighlightColor, 
  highlightRenderer,
  ensureHighlightStyles,
  generateHighlightId,
  getTextNodesInRange,
  wrapRangeSimple,
  wrapTextNodes,
  findArticleContainer,
  removeHighlightSpan,
  updateHighlightColor,
  HIGHLIGHT_COLORS,
} from "../services/highlightRenderer";
import { highlightStorage } from "../services/highlightStorage";
import { highlightAnchor } from "../services/highlightAnchor";
import { createLogger } from "../utils/logger";

const logger = createLogger("use-highlight");

// Re-export types
export type { HighlightColor };
export { HIGHLIGHT_COLORS };

interface UseHighlightOptions {
  containerRef: RefObject<HTMLElement | null>;
}

interface UseHighlightReturn {
  applyHighlight: (color: HighlightColor, note?: string) => boolean;
  removeHighlight: (element: Element) => boolean;
  updateNote: (element: Element, note: string) => boolean;
  changeColor: (element: Element, color: HighlightColor) => boolean;
  getAllHighlights: () => Element[];
}

/**
 * Hook for managing highlight operations
 */
export function useHighlight({ containerRef }: UseHighlightOptions): UseHighlightReturn {
  
  /**
   * Apply highlight to current selection
   */
  const applyHighlight = useCallback((color: HighlightColor, note?: string): boolean => {
    const doc = containerRef.current?.ownerDocument || document;
    const selection = doc.getSelection();

    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return false;

    const text = range.toString().trim();
    if (!text) return false;

    // Ensure styles are injected
    ensureHighlightStyles(doc);

    const highlightId = generateHighlightId();
    const isSimpleSelection = range.startContainer === range.endContainer 
      && range.startContainer.nodeType === Node.TEXT_NODE;

    let success = false;
    let anchorNode: Node = range.startContainer;

    if (isSimpleSelection) {
      // Simple case: single text node
      const span = wrapRangeSimple(doc, range, color, highlightId, note);
      success = span !== null;
      if (span) anchorNode = span;
    } else {
      // Complex case: multiple nodes
      const textNodes = getTextNodesInRange(range, doc);
      if (textNodes.length > 0) {
        success = wrapTextNodes(doc, textNodes, range, color, highlightId, note);
        anchorNode = textNodes[0];
      }
    }

    if (success) {
      // Save to storage
      const articleContainer = findArticleContainer(anchorNode);
      if (articleContainer) {
        articleContainer.classList.add("readlite-article-container");
      }

      const anchorData = highlightAnchor.createAnchorData(anchorNode, text);
      
      highlightStorage.saveHighlight({
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
      }).then(() => {
        logger.info(`Highlight saved: ${highlightId}`);
      }).catch((error) => {
        logger.error("Failed to save highlight:", error);
      });

      // Clear selection
      selection.removeAllRanges();
    }

    return success;
  }, [containerRef]);

  /**
   * Remove a highlight element
   */
  const removeHighlight = useCallback((element: Element): boolean => {
    if (!element?.parentNode) return false;

    const doc = containerRef.current?.ownerDocument || document;
    const highlightId = element.getAttribute("data-highlight-id");

    const success = removeHighlightSpan(element, doc);

    if (success && highlightId) {
      highlightStorage.deleteHighlight(highlightId)
        .then((deleted) => {
          if (deleted) {
            logger.info(`Highlight removed from storage: ${highlightId}`);
          }
        })
        .catch((error) => {
          logger.error("Failed to delete highlight from storage:", error);
        });
    }

    return success;
  }, [containerRef]);

  /**
   * Update note on a highlight
   */
  const updateNote = useCallback((element: Element, note: string): boolean => {
    if (!element) return false;

    try {
      element.setAttribute("data-note", note);
      element.setAttribute("title", note);

      const highlightId = element.getAttribute("data-highlight-id");
      if (highlightId) {
        highlightStorage.updateHighlight(highlightId, { 
          note, 
          updatedAt: Date.now() 
        }).catch((error) => {
          logger.error("Failed to update note in storage:", error);
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to update note:", error);
      return false;
    }
  }, []);

  /**
   * Change highlight color
   */
  const changeColor = useCallback((element: Element, color: HighlightColor): boolean => {
    if (!element) return false;

    const success = updateHighlightColor(element, color);

    if (success) {
      const highlightId = element.getAttribute("data-highlight-id");
      if (highlightId) {
        highlightStorage.updateHighlight(highlightId, { 
          color, 
          updatedAt: Date.now() 
        }).catch((error) => {
          logger.error("Failed to update color in storage:", error);
        });
      }
    }

    return success;
  }, []);

  /**
   * Get all highlights in the container
   */
  const getAllHighlights = useCallback((): Element[] => {
    const container = containerRef.current;
    if (!container) return [];

    const doc = container.ownerDocument || document;
    return Array.from(doc.querySelectorAll(".readlite-highlight"));
  }, [containerRef]);

  return {
    applyHighlight,
    removeHighlight,
    updateNote,
    changeColor,
    getAllHighlights,
  };
}
