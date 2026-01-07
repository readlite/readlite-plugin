import { useState, useEffect, useCallback, useRef } from "react";
import { highlightStorage } from "../services/highlightStorage";
import { highlightAnchor } from "../services/highlightAnchor";
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger("highlights");

// Define highlight color type - simplified to 3 essential colors
export type HighlightColor = "yellow" | "blue" | "purple";

// Color configuration with consistent values
const HIGHLIGHT_COLORS = {
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

// Define the position and content of the selected text
interface TextSelection {
  text: string;
  rect: DOMRect | null;
  isActive: boolean;
  highlightElement?: Element | null; // Reference to highlighted element when clicking on existing highlight
}

// Helper to generate a unique ID for each highlight
const generateHighlightId = (): string => {
  return `highlight-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

// Helper function to find all text nodes within a range
const getAllTextNodesInRange = (range: Range, doc: Document): Text[] => {
  // Get the common ancestor container
  const container = range.commonAncestorContainer;

  // Function to check if a node is at least partially in the range
  const nodeInRange = (node: Node): boolean => {
    if (node.nodeType !== Node.TEXT_NODE) return false;

    const nodeRange = doc.createRange();
    nodeRange.selectNodeContents(node);

    // Check if this node intersects with the selection range
    return (
      range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0 &&
      range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0
    );
  };

  // Function to collect all text nodes in the container
  const collectTextNodes = (node: Node, textNodes: Text[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (nodeInRange(node) && node.textContent && node.textContent.trim()) {
        textNodes.push(node as Text);
      }
    } else {
      // Recurse into child nodes
      for (let i = 0; i < node.childNodes.length; i++) {
        collectTextNodes(node.childNodes[i], textNodes);
      }
    }
  };

  const textNodes: Text[] = [];
  collectTextNodes(container, textNodes);
  return textNodes;
};

// Helper to clean up any empty highlight spans
const clearEmptyHighlightSpans = (container: Node): void => {
  if (container.nodeType === Node.ELEMENT_NODE) {
    const emptySpans = (container as Element).querySelectorAll(
      "span.readlite-highlight:empty",
    );
    emptySpans.forEach((span) => span.parentNode?.removeChild(span));

    // Also remove spans that only contain whitespace
    const spans = (container as Element).querySelectorAll(
      "span.readlite-highlight",
    );
    spans.forEach((span) => {
      if (!span.textContent || !span.textContent.trim()) {
        span.parentNode?.removeChild(span);
      }
    });
  }
};

// Helper to ensure highlight styles are in the document
const ensureHighlightStyles = (doc: Document): void => {
  if (doc.getElementById("readlite-highlight-styles")) return;

  const style = doc.createElement("style");
  style.id = "readlite-highlight-styles";

  // Use hardcoded colors instead of CSS variables for compatibility
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

// Helper to create a highlight element
const createHighlightElement = (
  doc: Document,
  color: HighlightColor,
  note?: string,
): HTMLSpanElement => {
  const highlightSpan = doc.createElement("span");
  highlightSpan.className = `readlite-highlight readlite-highlight-${color}`;
  highlightSpan.dataset.highlightColor = color;
  highlightSpan.dataset.highlightId = generateHighlightId();

  // Add inline styles to ensure background color is always effective
  highlightSpan.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

  if (note) {
    highlightSpan.dataset.note = note;
    highlightSpan.title = note;
  }

  return highlightSpan;
};

// Create a debounce function for handling frequent events
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number,
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

// Hook for using text selection - Updated type definition to accommodate any HTMLElement type
export function useTextSelection<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
) {
  // Store selected text information
  const [selection, setSelection] = useState<TextSelection>({
    text: "",
    rect: null,
    isActive: false,
  });

  // Use ref to track the latest selection state to avoid closure issues
  const selectionStateRef = useRef(selection);

  // Update ref when state changes
  useEffect(() => {
    selectionStateRef.current = selection;
  }, [selection]);

  // Clear the selected text
  const clearSelection = useCallback(() => {
    // Use the selection object from the iframe document if applicable
    try {
      const doc = containerRef.current?.ownerDocument || document;
      doc.getSelection()?.removeAllRanges();
    } catch (e) {
      console.error("Failed to clear selection:", e);
      // Fallback to default behavior
      window.getSelection()?.removeAllRanges();
    }

    setSelection({
      text: "",
      rect: null,
      isActive: false,
    });
  }, [containerRef]);

  // Fallback approach - try a more advanced method for complicated DOM structures
  const applyHighlightWithAdvancedDomManipulation = useCallback(
    (
      doc: Document,
      range: Range,
      color: HighlightColor,
      note?: string,
    ): boolean => {
      try {
        logger.info("Using advanced DOM manipulation for complex selection");

        // Create a clone of the range to avoid modifying the original
        const clonedRange = range.cloneRange();
        const highlightId = generateHighlightId();
        const highlightText = range.toString().trim();

        // Create a document fragment from the range content
        const fragment = clonedRange.extractContents();

        // Create a temp container to work with the content
        const tempContainer = doc.createElement("div");
        tempContainer.appendChild(fragment);

        logger.info(`Extracted HTML content: ${tempContainer.innerHTML}`);

        // Function to recursively process nodes and wrap text with highlight spans
        const processNode = (node: Node) => {
          // Skip empty/whitespace-only text nodes
          if (node.nodeType === Node.TEXT_NODE) {
            if (!node.textContent || !node.textContent.trim()) {
              return node; // Return unchanged
            }

            // Create highlight span for text node
            const span = doc.createElement("span");
            span.className = `readlite-highlight readlite-highlight-${color}`;
            span.dataset.highlightColor = color;
            span.dataset.highlightId = highlightId;
            if (note) {
              span.dataset.note = note;
              span.title = note;
            }
            span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

            // Clone the text node and append to span
            span.appendChild(node.cloneNode(true));
            return span;
          }
          // For element nodes, process their children
          else if (node.nodeType === Node.ELEMENT_NODE) {
            // Clone the element to avoid modifying the original
            const element = node.cloneNode(false) as Element;

            // Process each child node
            for (let i = 0; i < node.childNodes.length; i++) {
              const processedChild = processNode(node.childNodes[i]);
              element.appendChild(processedChild);
            }

            return element;
          }

          // Default case - return the node unchanged
          return node.cloneNode(true);
        };

        // Process the extracted content
        const processedContent = processNode(tempContainer);

        // Replace the range with the processed content
        clonedRange.insertNode(processedContent);

        // Try to find the article container for more consistent anchoring
        const findArticleContainer = (element: Node): Element | null => {
          let current =
            element.nodeType === Node.TEXT_NODE
              ? element.parentElement
              : (element as Element);

          // Walk up the DOM tree looking for article container indicators
          while (current && current !== document.body) {
            // Look for common article container indicators
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
              logger.info(
                `Found article container for anchoring: ${current.tagName}`,
              );
              return current;
            }
            current = current.parentElement as Element;
          }
          return null;
        };

        // Find the article container (if any)
        const articleContainer = findArticleContainer(processedContent);

        // If found, add a class to make it more identifiable in the future
        if (articleContainer) {
          articleContainer.classList.add("readlite-article-container");
        }

        // Save highlight to storage
        const anchorData = highlightAnchor.createAnchorData(
          processedContent,
          highlightText,
        );

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

        logger.info(
          `Successfully applied advanced highlight to complex content`,
        );
        return true;
      } catch (error) {
        logger.error("Advanced DOM manipulation highlight failed:", error);
        return false;
      }
    },
    [],
  );

  // Apply highlight strategy using DOM manipulation
  const applyHighlightWithDomManipulation = useCallback(
    (
      doc: Document,
      range: Range,
      color: HighlightColor,
      note?: string,
    ): boolean => {
      try {
        // Clone the range before manipulation
        const clonedRange = range.cloneRange();

        // Generate a unique ID shared by all spans in this highlight operation
        const highlightId = generateHighlightId();

        // Get the text content before applying highlight
        const highlightText = range.toString().trim();

        // Create a surrounding span for the selected content
        const createSpan = () => {
          const span = doc.createElement("span");
          span.className = `readlite-highlight readlite-highlight-${color}`;
          span.dataset.highlightColor = color;
          // Use shared ID
          span.dataset.highlightId = highlightId;

          // Add inline styles to ensure background color is always effective
          span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

          if (note) {
            span.dataset.note = note;
            span.title = note;
          }

          return span;
        };

        // Log information about the start and end containers
        logger.info(
          `Selection start container: ${range.startContainer.nodeName}, end container: ${range.endContainer.nodeName}`,
        );
        logger.info(
          `Selection crosses element boundaries: ${range.startContainer !== range.endContainer}`,
        );

        // Check if selection contains elements like <b> or other inline elements
        const hasNestedElements = (() => {
          // Check if start and end containers are different
          if (range.startContainer !== range.endContainer) {
            // Check if either container is an element node or has element node parents
            const startIsOrHasElementParent =
              range.startContainer.nodeType === Node.ELEMENT_NODE ||
              range.startContainer.parentElement !==
                range.endContainer.parentElement;
            const endIsOrHasElementParent =
              range.endContainer.nodeType === Node.ELEMENT_NODE;

            return startIsOrHasElementParent || endIsOrHasElementParent;
          }
          return false;
        })();

        // Simple case: entirely within a single text node
        if (
          !hasNestedElements &&
          range.startContainer === range.endContainer &&
          range.startContainer.nodeType === Node.TEXT_NODE
        ) {
          const highlightSpan = createSpan();
          range.surroundContents(highlightSpan);

          // Store the first node for anchoring data
          const firstNode = range.startContainer;

          // Try to find the article container for more consistent anchoring
          const findArticleContainer = (element: Node): Element | null => {
            let current =
              element.nodeType === Node.TEXT_NODE
                ? element.parentElement
                : (element as Element);

            // Walk up the DOM tree looking for article container indicators
            while (current && current !== document.body) {
              // Look for common article container indicators
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
                logger.info(
                  `Found article container for anchoring: ${current.tagName}`,
                );
                return current;
              }
              current = current.parentElement as Element;
            }
            return null;
          };

          // Find the article container (if any)
          const articleContainer = findArticleContainer(firstNode);

          // If found, add a class to make it more identifiable in the future
          if (articleContainer) {
            articleContainer.classList.add("readlite-article-container");
          }

          // Save the highlight to storage
          const anchorData = highlightAnchor.createAnchorData(
            firstNode,
            highlightText,
          );

          highlightStorage.saveHighlight({
            id: highlightId,
            url: window.location.href,
            text: highlightText,
            color: color,
            note: note,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            textBefore: anchorData.textBefore,
            textAfter: anchorData.textAfter,
            domPath: anchorData.domPath,
            nodeIndex: anchorData.nodeIndex,
          });

          logger.info(
            `Saved highlight to storage (simple case): ${highlightId}`,
          );

          return true;
        }

        // Complex case: multiple nodes or partial nodes or crossing element boundaries
        // Use a different approach that works with selections that span element boundaries
        logger.info(
          `Using complex case highlight approach for selection spanning elements`,
        );

        // Get all nodes in the selection range
        const nodes = getAllTextNodesInRange(range, doc);

        if (nodes.length === 0) {
          logger.warn("No text nodes found in selection");

          // Try fallback approach for element nodes - create a temporary document fragment
          try {
            // Extract the content and wrap it in a fragment
            const fragment = range.extractContents();
            const tempContainer = doc.createElement("div");
            tempContainer.appendChild(fragment);

            logger.info(`Extracted HTML: ${tempContainer.innerHTML}`);

            // Create a highlight span with the extracted content
            const highlightSpan = createSpan();
            highlightSpan.innerHTML = tempContainer.innerHTML;

            // Insert the highlight span
            range.insertNode(highlightSpan);

            // Store the first node for anchoring data
            const firstNode = nodes[0];

            // Try to find the article container for more consistent anchoring
            const findArticleContainer = (element: Node): Element | null => {
              let current =
                element.nodeType === Node.TEXT_NODE
                  ? element.parentElement
                  : (element as Element);

              // Walk up the DOM tree looking for article container indicators
              while (current && current !== document.body) {
                // Look for common article container indicators
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
                  logger.info(
                    `Found article container for anchoring: ${current.tagName}`,
                  );
                  return current;
                }
                current = current.parentElement as Element;
              }
              return null;
            };

            // Find the article container (if any)
            const articleContainer = findArticleContainer(firstNode);

            // If found, add a class to make it more identifiable in the future
            if (articleContainer) {
              articleContainer.classList.add("readlite-article-container");
            }

            // Save the highlight to storage
            const anchorData = highlightAnchor.createAnchorData(
              firstNode,
              highlightText,
            );

            highlightStorage.saveHighlight({
              id: highlightId,
              url: window.location.href,
              text: highlightText,
              color: color,
              note: note,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              textBefore: anchorData.textBefore,
              textAfter: anchorData.textAfter,
              domPath: anchorData.domPath,
              nodeIndex: anchorData.nodeIndex,
            });

            logger.info(
              `Applied highlight using fragment extraction approach: ${highlightId}`,
            );
            return true;
          } catch (e) {
            logger.error("Fragment extraction approach failed:", e);
            return false;
          }
        }

        // Store the first node for anchoring data
        const firstNode = nodes[0];

        // Process nodes in reverse to avoid changing positions
        nodes.reverse().forEach((textNode) => {
          const nodeRange = doc.createRange();

          // Determine if this is the start or end node
          const isStartNode = textNode === range.startContainer;
          const isEndNode = textNode === range.endContainer;

          // Set appropriate start and end points
          nodeRange.setStart(textNode, isStartNode ? range.startOffset : 0);
          nodeRange.setEnd(
            textNode,
            isEndNode ? range.endOffset : textNode.length,
          );

          // Only highlight if there's content
          if (nodeRange.toString().trim()) {
            // Create a highlight span for this text segment - with shared ID
            const spanForNode = createSpan();

            try {
              // Extract content and wrap in span
              const content = nodeRange.extractContents();
              spanForNode.appendChild(content);
              nodeRange.insertNode(spanForNode);
            } catch (e) {
              // If surroundContents fails (which can happen with partial node selections),
              // try an alternative approach
              logger.warn(
                `Failed to extract contents for node, using alternative approach:`,
                e,
              );

              try {
                // Get the text and create a new text node
                const text = nodeRange.toString();
                if (text && text.trim()) {
                  const textNode = doc.createTextNode(text);
                  spanForNode.appendChild(textNode);

                  // Clear the original range content and insert the span
                  nodeRange.deleteContents();
                  nodeRange.insertNode(spanForNode);
                }
              } catch (e2) {
                logger.error(
                  `Failed alternative node highlighting approach:`,
                  e2,
                );
              }
            }
          }
        });

        // Clean up any empty spans created in the process
        clearEmptyHighlightSpans(range.commonAncestorContainer);

        // Try to find the article container for more consistent anchoring
        const findArticleContainer = (element: Node): Element | null => {
          let current =
            element.nodeType === Node.TEXT_NODE
              ? element.parentElement
              : (element as Element);

          // Walk up the DOM tree looking for article container indicators
          while (current && current !== document.body) {
            // Look for common article container indicators
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
              logger.info(
                `Found article container for anchoring: ${current.tagName}`,
              );
              return current;
            }
            current = current.parentElement as Element;
          }
          return null;
        };

        // Find the article container (if any)
        const articleContainer = findArticleContainer(firstNode);

        // If found, add a class to make it more identifiable in the future
        if (articleContainer) {
          articleContainer.classList.add("readlite-article-container");
        }

        // Save the highlight to storage
        const anchorData = highlightAnchor.createAnchorData(
          firstNode,
          highlightText,
        );

        highlightStorage.saveHighlight({
          id: highlightId,
          url: window.location.href,
          text: highlightText,
          color: color,
          note: note,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          textBefore: anchorData.textBefore,
          textAfter: anchorData.textAfter,
          domPath: anchorData.domPath,
          nodeIndex: anchorData.nodeIndex,
        });

        logger.info(
          `Saved highlight to storage (complex case): ${highlightId}`,
        );

        return true;
      } catch (error) {
        console.error("DOM manipulation highlight failed:", error);
        return false;
      }
    },
    [],
  );

  // Apply highlight strategy using execCommand (primary approach)
  const applyHighlightWithExecCommand = useCallback(
    (
      doc: Document,
      selection: Selection,
      color: HighlightColor,
      note?: string,
    ): boolean => {
      try {
        // Log selection information for debugging
        logger.info(
          `Highlighting selection with execCommand: "${selection.toString().trim()}"`,
        );

        if (selection.rangeCount === 0) {
          logger.warn("No range in selection");
          return false;
        }

        const range = selection.getRangeAt(0);
        logger.info(
          `Selection range - startContainer: ${range.startContainer.nodeName}, endContainer: ${range.endContainer.nodeName}`,
        );

        // Check if the selection crosses element boundaries or contains bold tags
        const crossesElements = range.startContainer !== range.endContainer;
        const container =
          range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : (range.commonAncestorContainer as Element);

        // Check for bold tags within the selection
        const hasBoldTags =
          container && container.querySelectorAll("b, strong").length > 0;

        if (crossesElements) {
          logger.info(
            `Selection crosses element boundaries, may contain formatted text like <b> tags`,
          );
        }

        if (hasBoldTags) {
          logger.info(`Selection contains bold tags, special handling needed`);

          // Check if bold tags are within the selection range
          const boldTagsInRange = Array.from(
            container.querySelectorAll("b, strong") || [],
          ).filter((boldTag) => {
            // Check if the bold tag is at least partially in the range
            return (
              range.intersectsNode(boldTag) &&
              // Additional check to see if it's really selected
              (selection.containsNode(boldTag, true) ||
                selection.toString().includes(boldTag.textContent || ""))
            );
          });

          if (boldTagsInRange.length > 0) {
            logger.info(
              `Found ${boldTagsInRange.length} bold tags in the selection, using special treatment`,
            );

            // For selections containing bold tags, use the advanced manipulation approach
            // which better handles mixed formatting
            return applyHighlightWithAdvancedDomManipulation(
              doc,
              range,
              color,
              note,
            );
          }
        }

        // Use the background color for highlighting
        const bgColor = HIGHLIGHT_COLORS[color].background;

        // Generate a unique ID for all spans from this highlight operation
        const highlightId = generateHighlightId();

        // Store original selection text for anchoring
        const highlightText = selection.toString().trim();

        // Apply highlight with execCommand
        doc.execCommand("hiliteColor", false, bgColor);

        // After highlighting, find the highlighted elements and add our classes
        // We need to look for background-color style since that's what execCommand sets
        // Get the common ancestor first - this limits our search scope
        if (!container) {
          logger.warn("Couldn't find container element for selection");
          return false;
        }

        // Get all elements in the container that might be our highlights
        const elements = Array.from(
          container.querySelectorAll('[style*="background-color"]'),
        );

        // If no highlighted elements found in the initial search, try a broader approach
        if (elements.length === 0) {
          logger.warn(
            "No elements found with background-color style, trying broader search",
          );

          // Try finding elements in the entire document (sometimes execCommand can affect elements outside the immediate container)
          const allHighlighted = Array.from(
            doc.querySelectorAll('[style*="background-color"]'),
          );

          // Filter to recent elements (those likely created by this operation)
          const recentHighlights = allHighlighted.filter((el) => {
            const style = window.getComputedStyle(el);
            const elBgColor = style.backgroundColor;
            return (
              elBgColor === bgColor || elBgColor.includes(bgColor.slice(0, -4))
            );
          });

          if (recentHighlights.length > 0) {
            logger.info(
              `Found ${recentHighlights.length} highlighted elements in broader search`,
            );
            elements.push(...recentHighlights);
          }
        }

        // For difficult selections involving multiple elements, we might need to manually create a highlight
        if (elements.length === 0 && (crossesElements || hasBoldTags)) {
          logger.info(
            "No highlighted elements found with execCommand, trying advanced DOM approach",
          );

          // Fall back to the advanced DOM manipulation approach for complex selections
          return applyHighlightWithAdvancedDomManipulation(
            doc,
            range,
            color,
            note,
          );
        }

        // Filter to just elements that were likely part of our highlight
        const highlightedElements = elements.filter((el) => {
          const style = window.getComputedStyle(el);
          const elBgColor = style.backgroundColor;
          // Simple color matching (this is approximate)
          return (
            elBgColor === bgColor || elBgColor.includes(bgColor.slice(0, -4))
          );
        });

        if (highlightedElements.length === 0) {
          logger.warn("No elements matched our highlight color");

          // Try advanced DOM manipulation approach as fallback
          return applyHighlightWithAdvancedDomManipulation(
            doc,
            range,
            color,
            note,
          );
        }

        logger.info(
          `Found ${highlightedElements.length} highlighted elements to process`,
        );

        // Add our custom classes and data attributes to the highlighted elements
        highlightedElements.forEach((el) => {
          // Check if this element has any child elements that are also highlighted
          // If so, we'll need special handling to avoid nested highlights
          const hasHighlightedChildren =
            el.querySelectorAll('[style*="background-color"]').length > 0;

          if (hasHighlightedChildren) {
            logger.info(
              `Element has highlighted children, special handling needed`,
            );
            // This is a complex case - we'll keep the structure but ensure consistent styling
            el.querySelectorAll('[style*="background-color"]').forEach(
              (child) => {
                child.classList.add(
                  "readlite-highlight",
                  `readlite-highlight-${color}`,
                );
                child.setAttribute("data-highlight-color", color);
                child.setAttribute("data-highlight-id", highlightId);
                if (note) {
                  child.setAttribute("data-note", note);
                  child.setAttribute("title", note);
                }
              },
            );
          }

          el.classList.add("readlite-highlight", `readlite-highlight-${color}`);
          el.setAttribute("data-highlight-color", color);
          // Use shared ID for all spans that are part of this highlight
          el.setAttribute("data-highlight-id", highlightId);
          if (note) {
            el.setAttribute("data-note", note);
            el.setAttribute("title", note);
          }
        });

        // Save to storage if we successfully applied the highlight
        if (highlightedElements.length > 0) {
          // For anchoring, prefer a text node or the most specific element
          const firstElement = (() => {
            // Try to find a text node first
            for (const el of highlightedElements) {
              if (
                el.childNodes.length === 1 &&
                el.firstChild?.nodeType === Node.TEXT_NODE
              ) {
                return el.firstChild;
              }
            }
            // Otherwise use the first element
            return highlightedElements[0];
          })();

          // Try to find the article container for more consistent anchoring
          const findArticleContainer = (element: Node): Element | null => {
            let current =
              element.nodeType === Node.TEXT_NODE
                ? element.parentElement
                : (element as Element);

            // Walk up the DOM tree looking for article container indicators
            while (current && current !== document.body) {
              // Look for common article container indicators
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
                logger.info(
                  `Found article container for anchoring: ${current.tagName}`,
                );
                return current;
              }
              current = current.parentElement as Element;
            }
            return null;
          };

          // Find the article container (if any)
          const articleContainer = findArticleContainer(firstElement);

          // If found, add a class to make it more identifiable in the future
          if (articleContainer) {
            articleContainer.classList.add("readlite-article-container");
          }

          // Create anchoring data for storage
          const anchorData = highlightAnchor.createAnchorData(
            firstElement,
            highlightText,
          );

          // Save the highlight to storage
          highlightStorage.saveHighlight({
            id: highlightId,
            url: window.location.href,
            text: highlightText,
            color: color,
            note: note,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            textBefore: anchorData.textBefore,
            textAfter: anchorData.textAfter,
            domPath: anchorData.domPath,
            nodeIndex: anchorData.nodeIndex,
          });

          logger.info(`Saved highlight to storage: ${highlightId}`);
        }

        return true;
      } catch (error) {
        console.warn("execCommand highlight failed:", error);
        return false;
      }
    },
    [applyHighlightWithAdvancedDomManipulation],
  );

  // Fallback highlight strategy using execCommand with setTimeout
  const applyHighlightWithFallback = useCallback(
    (
      doc: Document,
      selection: Selection,
      color: HighlightColor,
      note?: string,
    ): boolean => {
      try {
        // Use solid color for better compatibility
        const execCommandColor = HIGHLIGHT_COLORS[color].solid;

        // Create a shared ID for the entire highlight
        const sharedHighlightId = generateHighlightId();

        // Use execCommand as a fallback
        doc.execCommand("hiliteColor", false, execCommandColor);

        // Try to find the recently highlighted elements
        setTimeout(() => {
          const highlighted = doc.querySelectorAll(
            `[style*="background-color: ${execCommandColor}"]`,
          );
          const elements =
            highlighted.length > 0
              ? highlighted
              : doc
                  .getSelection()
                  ?.getRangeAt(0)
                  .commonAncestorContainer.parentElement?.querySelectorAll(
                    '[style*="background-color"]',
                  ) || [];

          Array.from(elements).forEach((node) => {
            if (node.nodeName !== "SPAN") {
              const span = doc.createElement("span");
              span.className = `readlite-highlight readlite-highlight-${color}`;
              span.dataset.highlightColor = color;
              // Use shared ID
              span.dataset.highlightId = sharedHighlightId;

              // Add inline styles for consistent highlighting
              span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

              if (note) {
                span.dataset.note = note;
                span.title = note;
              }

              // Copy the node's content
              while (node.firstChild) span.appendChild(node.firstChild);
              node.parentNode?.replaceChild(span, node);
            } else {
              (node as HTMLElement).classList.add(
                "readlite-highlight",
                `readlite-highlight-${color}`,
              );
              // Use shared ID
              (node as HTMLElement).dataset.highlightId = sharedHighlightId;
              if (note) {
                (node as HTMLElement).dataset.note = note;
                (node as HTMLElement).title = note;
              }
            }
          });
        }, 0);

        return true;
      } catch (error) {
        console.error("Fallback highlight failed:", error);
        return false;
      }
    },
    [],
  );

  // Apply highlight by individually wrapping each text node in the selection
  const applyHighlightByTextNode = useCallback(
    (
      doc: Document,
      range: Range,
      color: HighlightColor,
      note?: string,
    ): boolean => {
      try {
        logger.info("Using text-node-level highlighting");

        // Generate a unique ID shared by all spans in this highlight operation
        const highlightId = generateHighlightId();
        const highlightText = range.toString().trim();

        if (!highlightText) {
          logger.warn("No text in selection");
          return false;
        }

        // Get all text nodes in the range
        const textNodes = getAllTextNodesInRange(range, doc);
        logger.info(`Found ${textNodes.length} text nodes in selection`);

        if (textNodes.length === 0) {
          logger.warn("No text nodes found in selection");
          return false;
        }

        // Create a highlight span factory
        const createHighlightSpan = (text: string) => {
          const span = doc.createElement("span");
          span.className = `readlite-highlight readlite-highlight-${color}`;
          span.dataset.highlightColor = color;
          span.dataset.highlightId = highlightId;
          span.textContent = text;

          // Add inline styles to ensure background color is always effective
          span.style.cssText = `display: inline !important; white-space: inherit !important; background-color: ${HIGHLIGHT_COLORS[color].background} !important;`;

          if (note) {
            span.dataset.note = note;
            span.title = note;
          }

          return span;
        };

        // Highlight each text node individually
        textNodes.forEach((textNode, index) => {
          // Determine the text content to highlight in this node
          let nodeText = textNode.textContent || "";
          let startOffset = 0;
          let endOffset = nodeText.length;

          // Adjust offsets for the first and last nodes
          if (index === 0 && textNode === range.startContainer) {
            startOffset = range.startOffset;
          }

          if (
            index === textNodes.length - 1 &&
            textNode === range.endContainer
          ) {
            endOffset = range.endOffset;
          }

          // Skip if nothing to highlight in this node
          if (startOffset >= endOffset) return;

          try {
            // Create a range for this text node portion
            const nodeRange = doc.createRange();
            nodeRange.setStart(textNode, startOffset);
            nodeRange.setEnd(textNode, endOffset);

            // Get the text for this portion
            const text = nodeRange.toString();
            if (!text.trim()) return; // Skip empty/whitespace-only portions

            // Split this text node into three parts: before, highlight, after
            if (startOffset > 0) {
              // Keep text before the highlight
              const beforeText = nodeText.substring(0, startOffset);
              const beforeNode = doc.createTextNode(beforeText);
              textNode.parentNode?.insertBefore(beforeNode, textNode);
            }

            // Create the highlight span with the selected text
            const highlightSpan = createHighlightSpan(text);
            textNode.parentNode?.insertBefore(highlightSpan, textNode);

            if (endOffset < nodeText.length) {
              // Keep text after the highlight
              const afterText = nodeText.substring(endOffset);
              const afterNode = doc.createTextNode(afterText);
              textNode.parentNode?.insertBefore(afterNode, textNode);
            }

            // Remove the original text node
            textNode.parentNode?.removeChild(textNode);

            logger.info(
              `Highlighted text node: "${text.substring(0, 20)}${text.length > 20 ? "..." : ""}"`,
            );
          } catch (e) {
            logger.error(`Error highlighting text node: ${e}`);
          }
        });

        // Find article container for consistent anchoring
        const findArticleContainer = (element: Node): Element | null => {
          let current =
            element.nodeType === Node.TEXT_NODE
              ? element.parentElement
              : (element as Element);

          // Walk up the DOM tree looking for article container indicators
          while (current && current !== document.body) {
            // Look for common article container indicators
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
              logger.info(
                `Found article container for anchoring: ${current.tagName}`,
              );
              return current;
            }
            current = current.parentElement as Element;
          }
          return null;
        };

        // Use the first text node's parent for creating anchor data
        const firstNode = textNodes[0];
        const articleContainer = findArticleContainer(firstNode);

        // If found, add a class to make it more identifiable in the future
        if (articleContainer) {
          articleContainer.classList.add("readlite-article-container");
        }

        // Save the highlight to storage
        const anchorData = highlightAnchor.createAnchorData(
          firstNode,
          highlightText,
        );

        highlightStorage.saveHighlight({
          id: highlightId,
          url: window.location.href,
          text: highlightText,
          color: color,
          note: note,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          textBefore: anchorData.textBefore,
          textAfter: anchorData.textAfter,
          domPath: anchorData.domPath,
          nodeIndex: anchorData.nodeIndex,
        });

        logger.info(
          `Successfully applied text-node-level highlight to selection`,
        );
        return true;
      } catch (error) {
        logger.error("Text-node-level highlighting failed:", error);
        return false;
      }
    },
    [],
  );

  // Apply highlight style to the selected text (main function using the strategies defined above)
  const applyHighlight = useCallback(
    (color: HighlightColor, note?: string): boolean => {
      // Get the correct document and window objects
      const doc = containerRef.current?.ownerDocument || document;
      const selection = doc.getSelection();

      if (!selection || selection.rangeCount === 0) return false;

      const range = selection.getRangeAt(0);
      if (range.collapsed) return false;

      // Check if the selection is just whitespace or empty
      const text = range.toString().trim();
      if (!text) return false;

      // Add highlight styles to the document if not already present
      ensureHighlightStyles(doc);

      // Enhanced detection of complex selections that might include bold tags
      const isComplexSelection = (() => {
        // Check if selection crosses elements or contains elements
        if (range.startContainer !== range.endContainer) {
          return true;
        }

        // Check if common ancestor container has bold tags
        const container = range.commonAncestorContainer;
        if (container.nodeType === Node.ELEMENT_NODE) {
          // Check for any formatted tags within the container
          const formattedTags = (container as Element).querySelectorAll(
            "b, strong, em, i, u, mark, code",
          );
          if (formattedTags.length > 0) {
            return true;
          }
        }

        return false;
      })();

      logger.info(
        `Selection complexity check - isComplex: ${isComplexSelection}`,
      );

      // Always try the text-node-level approach first for complex selections with HTML tags
      if (isComplexSelection) {
        logger.info(
          "Detected complex selection, trying text-node-level method first",
        );
        if (applyHighlightByTextNode(doc, range.cloneRange(), color, note)) {
          clearSelection();
          return true;
        }
      }

      // Regular strategy attempts in order

      // Strategy 1: execCommand (works in most browsers)
      if (applyHighlightWithExecCommand(doc, selection, color, note)) {
        clearSelection();
        return true;
      }

      // Strategy 2: DOM manipulation (more accurate but may fail in complex DOM structures)
      if (applyHighlightWithDomManipulation(doc, range, color, note)) {
        clearSelection();
        return true;
      }

      // Strategy 3: Fallback (less precise but handles edge cases)
      if (applyHighlightWithFallback(doc, selection, color, note)) {
        clearSelection();
        return true;
      }

      // Try advanced DOM manipulation approaches as a last resort
      if (
        applyHighlightWithAdvancedDomManipulation(
          doc,
          range.cloneRange(),
          color,
          note,
        )
      ) {
        clearSelection();
        return true;
      }

      // Try the text-node approach as the final fallback if not already tried
      if (
        !isComplexSelection &&
        applyHighlightByTextNode(doc, range.cloneRange(), color, note)
      ) {
        clearSelection();
        return true;
      }

      // If all strategies fail
      console.error("All highlighting methods failed");
      return false;
    },
    [
      clearSelection,
      containerRef,
      applyHighlightWithExecCommand,
      applyHighlightWithDomManipulation,
      applyHighlightWithFallback,
      applyHighlightWithAdvancedDomManipulation,
      applyHighlightByTextNode,
    ],
  );

  // Remove highlight from text
  const removeHighlight = useCallback(
    (element: Element): boolean => {
      if (!element || !element.parentNode) {
        console.error(
          "Cannot remove highlight: Invalid element or missing parent",
        );
        return false;
      }

      try {
        const doc = containerRef.current?.ownerDocument || document;
        const fragment = doc.createDocumentFragment();

        // Check if it's an actual highlight
        if (!element.classList.contains("readlite-highlight")) {
          console.warn("Attempted to remove element that is not a highlight");
          return false;
        }

        // Get the highlight ID for storage removal
        const highlightId = element.getAttribute("data-highlight-id");

        // Move all children out of the highlight span
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }

        // Replace the highlight span with its contents
        element.parentNode.replaceChild(fragment, element);

        // Remove from storage if we have an ID
        if (highlightId) {
          highlightStorage
            .deleteHighlight(highlightId)
            .then((success) => {
              if (success) {
                console.log(
                  `Successfully removed highlight ${highlightId} from storage`,
                );
              } else {
                console.warn(
                  `Failed to remove highlight ${highlightId} from storage`,
                );
              }
            })
            .catch((error) => {
              console.error("Error removing highlight from storage:", error);
            });
        }

        // For debugging
        console.log("Successfully removed highlight");
        return true;
      } catch (error) {
        console.error("Failed to remove highlight:", error);
        return false;
      }
    },
    [containerRef],
  );

  // Update note on an existing highlight
  const updateHighlightNote = useCallback(
    (element: Element, note: string): boolean => {
      if (!element) return false;

      try {
        element.setAttribute("data-note", note);
        element.setAttribute("title", note);

        // Update in storage
        const highlightId = element.getAttribute("data-highlight-id");
        if (highlightId) {
          highlightStorage
            .updateHighlight(highlightId, { note, updatedAt: Date.now() })
            .then((success) => {
              if (success) {
                console.log(
                  `Successfully updated note for highlight ${highlightId} in storage`,
                );
              } else {
                console.warn(
                  `Failed to update note for highlight ${highlightId} in storage`,
                );
              }
            })
            .catch((error) => {
              console.error("Error updating highlight note in storage:", error);
            });
        }

        return true;
      } catch (error) {
        console.error("Failed to update highlight note:", error);
        return false;
      }
    },
    [],
  );

  // Change highlight color
  const changeHighlightColor = useCallback(
    (element: Element, color: HighlightColor): boolean => {
      if (!element) return false;

      try {
        // Remove all color classes
        element.classList.remove(
          "readlite-highlight-yellow",
          "readlite-highlight-blue",
          "readlite-highlight-purple",
        );

        // Add the new color class
        element.classList.add(`readlite-highlight-${color}`);
        element.setAttribute("data-highlight-color", color);

        // Update in storage
        const highlightId = element.getAttribute("data-highlight-id");
        if (highlightId) {
          highlightStorage
            .updateHighlight(highlightId, { color, updatedAt: Date.now() })
            .then((success) => {
              if (success) {
                console.log(
                  `Successfully updated color for highlight ${highlightId} in storage`,
                );
              } else {
                console.warn(
                  `Failed to update color for highlight ${highlightId} in storage`,
                );
              }
            })
            .catch((error) => {
              console.error(
                "Error updating highlight color in storage:",
                error,
              );
            });
        }

        return true;
      } catch (error) {
        console.error("Failed to change highlight color:", error);
        return false;
      }
    },
    [],
  );

  // Get all highlights in the container
  const getAllHighlights = useCallback((): Element[] => {
    try {
      const container = containerRef.current;
      if (!container) return [];

      const doc = container.ownerDocument || document;
      const highlights = doc.querySelectorAll(".readlite-highlight");

      return Array.from(highlights);
    } catch (error) {
      console.error("Failed to get highlights:", error);
      return [];
    }
  }, [containerRef]);

  // Listen for text selection events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Get the correct document and window objects
    const doc = container.ownerDocument || document;

    // Check if click is on a highlight element
    const handleClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element;

        // Check if the clicked element is a highlight
        const highlightElement = target.closest(".readlite-highlight");
        if (!highlightElement) return;

        const rect = highlightElement.getBoundingClientRect();

        // Create a selection object for the highlight
        setSelection({
          text: highlightElement.textContent || "",
          rect,
          isActive: true,
          highlightElement,
        });

        // Prevent default selection
        e.preventDefault();
      } catch (error) {
        console.error("Error handling highlight click:", error);
      }
    };

    // Optimized selection handler with debouncing
    const handleSelectionChange = debounce(() => {
      try {
        const selection = doc.getSelection();

        // If there is no selection, clear it if currently active
        if (
          !selection ||
          selection.rangeCount === 0 ||
          selection.toString().trim() === ""
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

        // Get selected text
        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        // Get the position of the selected area
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Check if rect is valid
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          console.warn("Invalid selection rect", rect);
          return;
        }

        // Only update if there's an actual change to reduce renders
        const currentSelection = selectionStateRef.current;
        if (
          currentSelection.text !== selectedText ||
          !currentSelection.rect ||
          !currentSelection.isActive
        ) {
          // Update selection state
          setSelection({
            text: selectedText,
            rect,
            isActive: true,
          });
        }
      } catch (e) {
        console.error("Error handling selection:", e);
      }
    }, 50); // 50ms debounce delay for smoother performance

    // Event listeners with appropriate handlers
    container.addEventListener("click", handleClick);
    container.addEventListener("mouseup", handleSelectionChange);
    container.addEventListener("touchend", handleSelectionChange);
    doc.addEventListener("selectionchange", handleSelectionChange);

    // Clean up event listeners
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("mouseup", handleSelectionChange);
      container.removeEventListener("touchend", handleSelectionChange);
      doc.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [containerRef]);

  // Calculate toolbar position, considering iframe context
  const calculatePosition = useCallback(() => {
    if (!selection.rect) return { top: 0, left: 0 };

    const toolbarWidth = 250;
    const toolbarHeight = 40;
    const spacing = 10;

    // Calculate initial position (bottom right)
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
}
