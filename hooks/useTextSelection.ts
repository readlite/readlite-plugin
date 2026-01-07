/**
 * useTextSelection Hook (Refactored)
 * 
 * This hook handles text selection detection and highlight operations.
 * DOM manipulation is delegated to highlightRenderer service.
 * 
 * Lines: ~280 (down from 1700+)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  HighlightColor, 
  HIGHLIGHT_COLORS,
  ensureHighlightStyles,
  applyHighlight as rendererApplyHighlight,
  saveHighlightToStorage,
  removeHighlightSpan,
  updateHighlightColor,
} from "../services/highlightRenderer";
import { highlightStorage } from "../services/highlightStorage";
import { createLogger } from "../utils/logger";

// Re-export types for consumers
export type { HighlightColor };
export { HIGHLIGHT_COLORS };

const logger = createLogger("text-selection");

// Selection state interface
interface TextSelection {
  text: string;
  rect: DOMRect | null;
  isActive: boolean;
  highlightElement?: Element | null;
}

// Debounce helper
const debounce = <F extends (...args: unknown[]) => unknown>(
  func: F,
  waitFor: number
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): void => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

/**
 * Hook for text selection and highlighting
 */
export function useTextSelection<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>
) {
  // Selection state
  const [selection, setSelection] = useState<TextSelection>({
    text: "",
    rect: null,
    isActive: false,
  });

  // Ref to track latest state (avoids stale closures)
  const selectionStateRef = useRef(selection);
  useEffect(() => {
    selectionStateRef.current = selection;
  }, [selection]);

  /**
   * Clear current selection
   */
  const clearSelection = useCallback(() => {
    try {
      const doc = containerRef.current?.ownerDocument || document;
      doc.getSelection()?.removeAllRanges();
    } catch (e) {
      window.getSelection()?.removeAllRanges();
    }
    setSelection({ text: "", rect: null, isActive: false });
  }, [containerRef]);

  /**
   * Apply highlight to current selection
   */
  const applyHighlight = useCallback(
    (color: HighlightColor, note?: string): boolean => {
      const doc = containerRef.current?.ownerDocument || document;
      const docSelection = doc.getSelection();

      if (!docSelection || docSelection.rangeCount === 0) return false;

      // Ensure styles are present
      ensureHighlightStyles(doc);

      // Use renderer to apply highlight
      const result = rendererApplyHighlight(doc, docSelection, color, note);

      if (result.success && result.highlightId && result.anchorNode) {
        // Save to storage
        const text = docSelection.toString().trim();
        saveHighlightToStorage(result.highlightId, text, color, result.anchorNode, note);
        
        clearSelection();
        return true;
      }

      return false;
    },
    [containerRef, clearSelection]
  );

  /**
   * Remove a highlight element
   */
  const removeHighlight = useCallback(
    (element: Element): boolean => {
      if (!element?.parentNode) {
        logger.error("Cannot remove highlight: Invalid element");
        return false;
      }

      const doc = containerRef.current?.ownerDocument || document;
      const highlightId = element.getAttribute("data-highlight-id");

      // Remove from DOM
      const success = removeHighlightSpan(element, doc);

      // Remove from storage
      if (success && highlightId) {
        highlightStorage.deleteHighlight(highlightId).catch((error) => {
          logger.error("Error removing highlight from storage:", error);
        });
      }

      return success;
    },
    [containerRef]
  );

  /**
   * Update note on an existing highlight
   */
  const updateHighlightNote = useCallback(
    (element: Element, note: string): boolean => {
      if (!element) return false;

      try {
        element.setAttribute("data-note", note);
        element.setAttribute("title", note);

        const highlightId = element.getAttribute("data-highlight-id");
        if (highlightId) {
          highlightStorage
            .updateHighlight(highlightId, { note, updatedAt: Date.now() })
            .catch((error) => {
              logger.error("Error updating note in storage:", error);
            });
        }

        return true;
      } catch (error) {
        logger.error("Failed to update note:", error);
        return false;
      }
    },
    []
  );

  /**
   * Change highlight color
   */
  const changeHighlightColor = useCallback(
    (element: Element, color: HighlightColor): boolean => {
      if (!element) return false;

      const success = updateHighlightColor(element, color);

      if (success) {
        const highlightId = element.getAttribute("data-highlight-id");
        if (highlightId) {
          highlightStorage
            .updateHighlight(highlightId, { color, updatedAt: Date.now() })
            .catch((error) => {
              logger.error("Error updating color in storage:", error);
            });
        }
      }

      return success;
    },
    []
  );

  /**
   * Get all highlights in container
   */
  const getAllHighlights = useCallback((): Element[] => {
    const container = containerRef.current;
    if (!container) return [];

    const doc = container.ownerDocument || document;
    return Array.from(doc.querySelectorAll(".readlite-highlight"));
  }, [containerRef]);

  /**
   * Calculate toolbar position
   */
  const calculatePosition = useCallback(() => {
    if (!selection.rect) return { top: 0, left: 0 };

    const toolbarWidth = 250;
    const toolbarHeight = 40;
    const spacing = 10;

    let left = selection.rect.right;
    let top = selection.rect.bottom + spacing;

    if (left + toolbarWidth > window.innerWidth) {
      left = window.innerWidth - toolbarWidth - spacing;
    }
    if (top + toolbarHeight > window.innerHeight) {
      top = selection.rect.top - toolbarHeight - spacing;
    }

    return { top, left };
  }, [selection.rect]);

  /**
   * Set up selection event listeners
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const doc = container.ownerDocument || document;

    // Handle clicks on existing highlights
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      const highlightElement = target.closest(".readlite-highlight");

      if (highlightElement) {
        const rect = highlightElement.getBoundingClientRect();
        setSelection({
          text: highlightElement.textContent || "",
          rect,
          isActive: true,
          highlightElement,
        });
        e.preventDefault();
      }
    };

    // Handle selection changes
    const handleSelectionChange = debounce(() => {
      try {
        const docSelection = doc.getSelection();

        if (!docSelection || docSelection.rangeCount === 0 || !docSelection.toString().trim()) {
          if (selectionStateRef.current.isActive && !selectionStateRef.current.highlightElement) {
            setSelection({ text: "", rect: null, isActive: false });
          }
          return;
        }

        const selectedText = docSelection.toString().trim();
        if (!selectedText) return;

        const range = docSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!rect || (rect.width === 0 && rect.height === 0)) return;

        const current = selectionStateRef.current;
        if (current.text !== selectedText || !current.rect || !current.isActive) {
          setSelection({
            text: selectedText,
            rect,
            isActive: true,
          });
        }
      } catch (e) {
        logger.error("Error handling selection:", e);
      }
    }, 50);

    // Attach listeners
    container.addEventListener("click", handleClick);
    container.addEventListener("mouseup", handleSelectionChange);
    container.addEventListener("touchend", handleSelectionChange);
    doc.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mouseup", handleSelectionChange);
      container.removeEventListener("touchend", handleSelectionChange);
      doc.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  return {
    selection,
    clearSelection,
    applyHighlight,
    removeHighlight,
    updateHighlightNote,
    changeHighlightColor,
    getAllHighlights,
    calculatePosition,
  };
}
