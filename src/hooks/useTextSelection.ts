import { useState, useEffect, useCallback, useRef } from "react";
import { highlightService, HighlightColor } from "../services/highlightService";
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger("highlights");

// Re-export HighlightColor type for backward compatibility
export type { HighlightColor };

// Define the position and content of the selected text
interface TextSelection {
  text: string;
  rect: DOMRect | null;
  isActive: boolean;
  highlightElement?: Element | null; // Reference to highlighted element when clicking on existing highlight
}

// Debounce helper function
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Hook for handling text selection and highlighting in the reader
 * Refactored to use centralized HighlightService for better maintainability
 */
export const useTextSelection = (
  containerRef: React.RefObject<HTMLElement | null>,
) => {
  const [selection, setSelection] = useState<TextSelection>({
    text: "",
    rect: null,
    isActive: false,
  });

  // Track selection state with ref to avoid stale closures
  const selectionStateRef = useRef(selection);
  useEffect(() => {
    selectionStateRef.current = selection;
  }, [selection]);

  // Ensure highlight styles are present in document
  const ensureHighlightStyles = useCallback((doc: Document) => {
    if (doc.getElementById("readlite-highlight-styles")) return;

    const styleElement = doc.createElement("style");
    styleElement.id = "readlite-highlight-styles";
    styleElement.textContent = `
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
      .readlite-highlight-beige { background-color: rgba(255,245,230,0.82) !important; }
      .readlite-highlight-cyan { background-color: rgba(181,228,255,0.82) !important; }
      .readlite-highlight-lavender { background-color: rgba(220,198,255,0.82) !important; }
      .readlite-highlight-olive { background-color: rgba(222,234,181,0.82) !important; }
      .readlite-highlight-peach { background-color: rgba(255,204,153,0.82) !important; }
      .readlite-highlight:hover { opacity: 0.8; }
    `;
    doc.head.appendChild(styleElement);
  }, []);

  // Clear current selection
  const clearSelection = useCallback(() => {
    try {
      const doc = containerRef.current?.ownerDocument || document;
      doc.getSelection()?.removeAllRanges();
    } catch (e) {
      logger.error("Failed to clear selection:", e);
      window.getSelection()?.removeAllRanges();
    }

    setSelection({
      text: "",
      rect: null,
      isActive: false,
    });
  }, [containerRef]);

  // Apply highlight using service
  const applyHighlight = useCallback(
    (color: HighlightColor, note?: string): boolean => {
      const doc = containerRef.current?.ownerDocument || document;
      const docSelection = doc.getSelection();

      if (!docSelection || docSelection.rangeCount === 0) return false;

      const range = docSelection.getRangeAt(0);
      if (range.collapsed) return false;

      const text = range.toString().trim();
      if (!text) return false;

      // Ensure highlight styles are present
      ensureHighlightStyles(doc);

      // Use the highlight service
      const success = highlightService.applyHighlight(
        doc,
        docSelection,
        color,
        note,
      );

      if (success) {
        clearSelection();
      }

      return success;
    },
    [clearSelection, containerRef, ensureHighlightStyles],
  );

  // Remove highlight from text
  const removeHighlight = useCallback(
    (element: Element): boolean => {
      return highlightService.removeHighlight(element);
    },
    [],
  );

  // Update note on an existing highlight
  const updateHighlightNote = useCallback(
    (element: Element, note: string): boolean => {
      return highlightService.updateHighlightNote(element, note);
    },
    [],
  );

  // Change highlight color
  const changeHighlightColor = useCallback(
    (element: Element, color: HighlightColor): boolean => {
      return highlightService.changeHighlightColor(element, color);
    },
    [],
  );

  // Get all highlights in the container
  const getAllHighlights = useCallback((): Element[] => {
    try {
      const container = containerRef.current;
      if (!container) return [];

      const doc = container.ownerDocument || document;
      return highlightService.getAllHighlights(doc);
    } catch (error) {
      logger.error("Failed to get highlights:", error);
      return [];
    }
  }, [containerRef]);

  // Listen for text selection events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const doc = container.ownerDocument || document;

    // Handle clicks on existing highlights
    const handleClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element;
        const highlightElement = target.closest(".readlite-highlight");
        
        if (!highlightElement) return;

        const rect = highlightElement.getBoundingClientRect();

        setSelection({
          text: highlightElement.textContent || "",
          rect,
          isActive: true,
          highlightElement,
        });

        e.preventDefault();
      } catch (error) {
        logger.error("Error handling highlight click:", error);
      }
    };

    // Handle text selection with debouncing
    const handleSelectionChange = debounce(() => {
      try {
        const docSelection = doc.getSelection();

        if (
          !docSelection ||
          docSelection.rangeCount === 0 ||
          docSelection.toString().trim() === ""
        ) {
          if (selectionStateRef.current.isActive) {
            setSelection({
              text: "",
              rect: null,
              isActive: false,
            });
          }
          return;
        }

        const selectedText = docSelection.toString().trim();
        if (!selectedText) return;

        const range = docSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (!rect || (rect.width === 0 && rect.height === 0)) {
          logger.warn("Invalid selection rect", rect);
          return;
        }

        const currentSelection = selectionStateRef.current;
        if (
          currentSelection.text !== selectedText ||
          !currentSelection.rect ||
          !currentSelection.isActive
        ) {
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

    // Add event listeners
    container.addEventListener("click", handleClick);
    container.addEventListener("mouseup", handleSelectionChange);
    container.addEventListener("touchend", handleSelectionChange);
    doc.addEventListener("selectionchange", handleSelectionChange);

    // Cleanup
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mouseup", handleSelectionChange);
      container.removeEventListener("touchend", handleSelectionChange);
      doc.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  // Calculate toolbar position
  const calculatePosition = useCallback(() => {
    if (!selection.rect) return { top: 0, left: 0 };

    const toolbarWidth = 250;
    const toolbarHeight = 40;
    const spacing = 10;

    let left = selection.rect.right;
    let top = selection.rect.bottom + spacing;

    // Screen boundary checks
    if (left + toolbarWidth > window.innerWidth) {
      left = window.innerWidth - toolbarWidth - spacing;
    }

    if (top + toolbarHeight > window.innerHeight) {
      top = selection.rect.top - toolbarHeight - spacing;
    }

    return { top, left };
  }, [selection.rect]);

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
};
