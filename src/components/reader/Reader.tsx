import React, { useState, useEffect, useRef, useCallback } from "react";
import { useReader } from "../../context/ReaderContext";
import Settings from "../settings/Settings";
import { useI18n } from "../../context/I18nContext";

import { LanguageCode } from "../../utils/language";
import { exportAsMarkdown } from "../../utils/export";
import ReaderToolbar from "../reader/ReaderToolbar";
import ReaderContent from "../reader/ReaderContent";
import { ThemeProvider } from "../../context/ThemeContext";
import { ThemeType } from "../../config/theme";
import { createLogger } from "../../utils/logger";
import SelectionToolbar from "../reader/SelectionToolbar";
import { HighlightColor } from "../../hooks/useTextSelection";
import { BookOpenIcon, XCircleIcon } from "@heroicons/react/24/outline";

// Create a logger for this module
const logger = createLogger("main-reader");

// Virtual highlight element type for selection handling
interface VirtualHighlightElement {
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
}

/**
 * Reading Progress Indicator Component
 * Shows a progress bar at the top of the reader
 */
const ReadingProgress: React.FC<{ scrollContainer?: HTMLElement | null }> = ({
  scrollContainer,
}) => {
  const [progress, setProgress] = useState(0);

  // Update progress as user scrolls
  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollPosition = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight - containerHeight;

      if (scrollHeight <= 0) return;

      const currentProgress = Math.min(
        100,
        Math.max(0, (scrollPosition / scrollHeight) * 100),
      );
      setProgress(currentProgress);
    };

    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [scrollContainer]);

  return (
    <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 pointer-events-none">
      <div
        className={`h-full transition-all duration-150 ease-out bg-accent`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

/**
 * Main Reader component
 * Displays the article in a clean, readable format.
 */
const Reader = () => {
  // Get reader state from context
  const { article, settings, isLoading, error, loadArticle } = useReader();

  // Additional state for reader functionality
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);

  // State for Reader UI
  const [showSettings, setShowSettings] = useState(false);
  const readerContentRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(
    null,
  ) as React.RefObject<HTMLButtonElement>;
  const [detectedLanguage] = useState<LanguageCode>("en");
  const [visibleContent, setVisibleContent] = useState("");

  // Get translations function
  const { t } = useI18n();

  // Reference to main reader column for scroll tracking
  const readerColumnRef = useRef<HTMLDivElement>(null);

  // Reference to shadowRoot created by StyleIsolator
  const readerContainerRef = useRef<HTMLDivElement>(null);

  // Extract current theme from settings for use with ThemeProvider
  const theme = settings.theme as ThemeType;

  // Text selection state
  const [selectionState, setSelectionState] = useState<{
    isActive: boolean;
    rect: DOMRect | null;
    highlightElement?: Element | VirtualHighlightElement | null;
    selectedText?: string;
    domPath?: {
      startPath: number[];
      endPath: number[];
      startOffset: number;
      endOffset: number;
    } | null;
  }>({
    isActive: false,
    rect: null,
    highlightElement: null,
    selectedText: "",
    domPath: null,
  });

  // Track scroll position for progress bar
  const [scrollProgress, setScrollProgress] = useState(0);

  // Track last removed highlight timestamp to prevent duplicates
  const lastRemoveHighlightRef = useRef(0);

  // Auto-scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const autoScrollIntervalRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [autoScrollSpeed] = useState(1.5); // Speed in pixels per frame (default: normal reading speed)

  // --- Lifecycle Effects ---

  // Log when Reader component mounts and check for container (Shadow DOM)
  useEffect(() => {
    logger.info("Reader component mounted");

    // Check for Shadow DOM container
    const shadowContainer =
      window.parent.document.getElementById("readlite-container");
    if (shadowContainer && shadowContainer.shadowRoot) {
      logger.info("Reader Shadow DOM container found");
      setIframeReady(true);
    } else {
      logger.warn("Reader container not found on component mount");

      const checkInterval = setInterval(() => {
        const checkShadow =
          window.parent.document.getElementById("readlite-container");

        if (checkShadow && checkShadow.shadowRoot) {
          logger.info("Reader container detected");
          setIframeReady(true);
          clearInterval(checkInterval);
        }
      }, 500);

      return () => clearInterval(checkInterval);
    }
  }, []);

  // Load article data when component mounts and container is ready
  useEffect(() => {
    if (iframeReady) {
      logger.info("Container ready, loading article content");
      loadArticle();
    }
  }, [iframeReady, loadArticle]);

  // --- Selection and Highlighting Handlers ---

  // Listen for text selection messages from ReaderContent
  useEffect(() => {
    let lastProcessedTimestamp = 0;

    const handleSelectionMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TEXT_SELECTED") {
        const now = Date.now();
        if (now - lastProcessedTimestamp < 50) return;

        lastProcessedTimestamp = now;

        let rect = event.data.rect;

        if (rect) {
          if (isFullscreen) {
            rect = {
              ...rect,
              left: isFinite(rect.left) ? rect.left : 0,
              top: isFinite(rect.top) ? rect.top : 0,
              right: isFinite(rect.right) ? rect.right : 0,
              bottom: isFinite(rect.bottom) ? rect.bottom : 0,
              width: isFinite(rect.width) ? rect.width : 0,
              height: isFinite(rect.height) ? rect.height : 0,
            };
          }

          if (rect.width > 0 && rect.height > 0) {
            let highlightElement = null;

            if (event.data.highlightData) {
              highlightElement = {
                getAttribute: (attr: string) => {
                  if (attr === "data-highlight-id")
                    return event.data.highlightData.id;
                  if (attr === "data-highlight-color")
                    return event.data.highlightData.color;
                  return null;
                },
              };
            }

            setSelectionState({
              isActive: event.data.isActive,
              rect: rect,
              highlightElement: highlightElement,
              selectedText: event.data.selectedText || "",
              domPath: event.data.domPath,
            });
          }
        }
      }
    };

    window.addEventListener("message", handleSelectionMessage);
    return () => {
      window.removeEventListener("message", handleSelectionMessage);
    };
  }, [isFullscreen]);

  // Handle copying selected text
  const handleCopy = useCallback(async () => {
    try {
      // Send message directly to window with the selected text
      window.postMessage(
        {
          type: "COPY_SELECTION",
          selectedText: selectionState.selectedText,
        },
        "*",
      );

      // Log success
      logger.info("Copy selection message sent");
    } catch (error) {
      logger.error("Error copying text:", error);
    }
  }, [selectionState.selectedText]);

  // Listen for copy operation completion
  useEffect(() => {
    const handleCopyComplete = (event: MessageEvent) => {
      if (event.data && event.data.type === "COPY_SELECTION_COMPLETE") {
        if (event.data.success) {
          logger.info("Copy operation completed successfully");
        } else {
          const errorMsg = event.data.error || "Unknown error";
          logger.warn("Copy operation failed:", errorMsg);
        }
      }
    };

    window.addEventListener("message", handleCopyComplete);
    return () => {
      window.removeEventListener("message", handleCopyComplete);
    };
  }, []);

  // Handle removing a highlight
  const handleRemoveHighlight = useCallback(
    (element: Element | VirtualHighlightElement) => {
      try {
        const now = Date.now();
        if (now - lastRemoveHighlightRef.current < 100) return;
        lastRemoveHighlightRef.current = now;

        if (!element) {
          logger.error("Cannot remove highlight: Invalid element");
          return;
        }

        const highlightId = element.getAttribute("data-highlight-id");
        if (!highlightId) {
          logger.error("Cannot remove highlight: Missing highlight ID");
          return;
        }

        // Send message directly to window
        window.postMessage(
          {
            type: "REMOVE_HIGHLIGHT",
            highlightId: highlightId,
          },
          "*",
        );

        // Keep selectedText in state but clear other properties
        setSelectionState((prev) => ({
          ...prev,
          isActive: false,
          rect: null,
          highlightElement: null,
        }));
      } catch (err) {
        logger.error("Error in handleRemoveHighlight:", err);
        // Keep selectedText in state but clear other properties
        setSelectionState((prev) => ({
          ...prev,
          isActive: false,
          rect: null,
          highlightElement: null,
        }));
      }
    },
    [],
  );

  // Handle text highlight
  const handleHighlight = useCallback((color: HighlightColor) => {
    try {
      // Send message directly to window
      window.postMessage({ type: "HIGHLIGHT_TEXT", color }, "*");
    } catch (err) {
      logger.error("Error in handleHighlight:", err);
      // Keep selectedText in state but clear other properties
      setSelectionState((prev) => ({
        ...prev,
        isActive: false,
        rect: null,
        highlightElement: null,
      }));
    }
  }, []);

  // Handle direct DOM selection in fullscreen mode
  const captureSelection = useCallback(() => {
    if (!isFullscreen) return;

    try {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (
          rect &&
          isFinite(rect.width) &&
          isFinite(rect.height) &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          setSelectionState({
            isActive: true,
            rect: rect,
            highlightElement: null,
            selectedText: "",
          });
        }
      }
    } catch (err) {
      logger.error("Error capturing selection:", err);
    }
  }, [isFullscreen, setSelectionState]);

  // Handle text selection events
  const handleTextSelection = useCallback(
    (_e: React.MouseEvent | React.TouchEvent) => {
      if (isFullscreen) {
        setTimeout(() => {
          captureSelection();
        }, 0);
      }
    },
    [isFullscreen, captureSelection],
  );

  // --- Fullscreen Effects ---

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Ensure text selection in fullscreen mode
  useEffect(() => {
    if (isFullscreen && readerContainerRef.current) {
      setTimeout(() => {
        if (readerContainerRef.current) {
          readerContainerRef.current.style.userSelect = "text";
          readerContainerRef.current.style.webkitUserSelect = "text";
        }
        if (readerContentRef.current) {
          readerContentRef.current.style.userSelect = "text";
          readerContentRef.current.style.webkitUserSelect = "text";
        }

        document.body.style.userSelect = "text";
        document.body.style.webkitUserSelect = "text";
      }, 100);
    }
  }, [isFullscreen]);

  // Special handling for text selection in fullscreen mode
  useEffect(() => {
    if (!isFullscreen) return;

    const style = document.createElement("style");
    style.id = "fullscreen-selection-style";
    style.textContent = `
      ::selection {
        background: rgba(0, 100, 255, 0.3) !important;
      }
      
      * {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      
      @media all {
        :fullscreen {
          -webkit-user-select: text !important;
          user-select: text !important;
        }
      }
      
      .readlite-selection-toolbar {
        position: fixed !important;
        z-index: 2147483647 !important;
        transform: translateZ(0) !important;
        pointer-events: auto !important;
      }
      
      .readlite-selection-toolbar button {
        pointer-events: auto !important;
      }
      
      :fullscreen .readlite-selection-toolbar {
        position: fixed !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
      }

      :root:fullscreen .readlite-selection-toolbar,
      :root:fullscreen ~ .readlite-selection-toolbar,
      :root:fullscreen > * .readlite-selection-toolbar {
        display: block !important;
      }
    `;
    document.head.appendChild(style);

    const handleFullscreenSelection = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setSelectionState({
            isActive: true,
            rect: rect,
            highlightElement: null,
            selectedText: "",
          });
        }
      }
    };

    document.addEventListener("mouseup", handleFullscreenSelection);
    document.addEventListener("selectionchange", () => {
      setTimeout(handleFullscreenSelection, 10);
    });

    return () => {
      const styleEl = document.getElementById("fullscreen-selection-style");
      if (styleEl) {
        styleEl.remove();
      }
      document.removeEventListener("mouseup", handleFullscreenSelection);
      document.removeEventListener(
        "selectionchange",
        handleFullscreenSelection,
      );
    };
  }, [isFullscreen, setSelectionState]);

  // Extract visible content when scrolling or resizing
  useEffect(() => {
    if (!readerContentRef.current || !article) return;

    const readerContent = readerContentRef.current;
    const readerColumn = readerContent.parentElement;

    if (!readerColumn) return;

    let lastScrollTop = readerColumn.scrollTop;
    let lastProcessedTime = Date.now();
    let scrollCounter = 0;
    let forceUpdateCounter = 0;

    const extractVisibleContent = () => {
      const currentScrollTop = readerColumn.scrollTop;
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTop);
      const timeDelta = Date.now() - lastProcessedTime;

      forceUpdateCounter++;
      const shouldForceUpdate = forceUpdateCounter >= 10;

      if (scrollDelta < 50 && timeDelta < 500 && !shouldForceUpdate) {
        return;
      }

      if (shouldForceUpdate) {
        forceUpdateCounter = 0;
      }

      scrollCounter++;
      lastScrollTop = currentScrollTop;
      lastProcessedTime = Date.now();

      const containerRect = readerContent.getBoundingClientRect();
      if (!containerRect) return;

      const textElements = readerContent.querySelectorAll(
        "p, h1, h2, h3, h4, h5, h6, li, blockquote",
      );

      if (!textElements || textElements.length === 0) {
        return;
      }

      const readerScrollTop = readerColumn.scrollTop;
      const readerViewportTop = 0;
      const readerViewportBottom = readerColumn.clientHeight;

      let visibleText = "";
      let visibleElementsCount = 0;
      const visibleElementsList = [];

      if (article.title) {
        visibleText += article.title + "\n\n";
      }

      textElements.forEach((el, _index) => {
        const rect = el.getBoundingClientRect();
        const offsetTop = rect.top + readerScrollTop - containerRect.top;

        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        const windowTop = 0;
        const windowBottom = window.innerHeight;

        const isVisibleSimple =
          elementBottom > windowTop && elementTop < windowBottom;

        const isVisible =
          isVisibleSimple ||
          (offsetTop < readerViewportBottom &&
            offsetTop + rect.height > readerViewportTop &&
            rect.height > 0);

        if (isVisible) {
          visibleElementsCount++;
          const elementText = el.textContent?.trim() || "";

          if (elementText) {
            const tagName = el.tagName.toLowerCase();
            const shortPreview =
              elementText.substring(0, 30) +
              (elementText.length > 30 ? "..." : "");
            visibleElementsList.push(`${tagName}: ${shortPreview}`);

            if (tagName.startsWith("h")) {
              visibleText += elementText + "\n\n";
            } else if (tagName === "li") {
              visibleText += "• " + elementText + "\n";
            } else if (tagName === "blockquote") {
              visibleText += "> " + elementText + "\n\n";
            } else {
              visibleText += elementText + "\n\n";
            }
          }
        }
      });

      const contentHash = `${visibleElementsCount}-${visibleText.length}-${visibleText.substring(0, 50)}`;
      const currentContentHash =
        sessionStorage.getItem("lastVisibleContentHash") || "";

      if (contentHash !== currentContentHash || shouldForceUpdate) {
        sessionStorage.setItem("lastVisibleContentHash", contentHash);
        setVisibleContent(visibleText);
      }
    };

    extractVisibleContent();

    setTimeout(() => {
      forceUpdateCounter = 100;
      extractVisibleContent();
    }, 1000);

    const handleScroll = () => {
      requestAnimationFrame(extractVisibleContent);
    };

    readerColumn.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      readerColumn.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      sessionStorage.removeItem("lastVisibleContentHash");
    };
  }, [article]);

  // Direct scroll handler for progress bar
  useEffect(() => {
    if (!readerColumnRef.current) return;

    const scrollContainer = readerColumnRef.current;

    const handleDirectScroll = () => {
      const scrollPosition = scrollContainer.scrollTop;
      const containerHeight = scrollContainer.clientHeight;
      const scrollHeight = scrollContainer.scrollHeight - containerHeight;

      if (scrollHeight <= 0) return;

      const progress = Math.min(
        100,
        Math.max(0, (scrollPosition / scrollHeight) * 100),
      );
      setScrollProgress(progress);
    };

    handleDirectScroll();

    scrollContainer.addEventListener("scroll", handleDirectScroll);
    return () =>
      scrollContainer.removeEventListener("scroll", handleDirectScroll);
  }, [readerColumnRef.current]);

  // --- UI Animation Setup ---

  useEffect(() => {
    if (readerContainerRef.current) {
      const doc = readerContainerRef.current.ownerDocument || document;

      if (!doc.getElementById("readlite-animation-styles")) {
        try {
          const style = doc.createElement("style");
          style.id = "readlite-animation-styles";
          style.textContent = `
            @keyframes fadeout {
              from { opacity: 1; }
              to { opacity: 0; }
            }
            
            .animate-fadeout {
              animation: fadeout 0.3s ease-out forwards;
            }
            
            @keyframes fadein {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            .animate-fadein {
              animation: fadein 0.3s ease-in forwards;
            }
          `;
          doc.head.appendChild(style);
        } catch (e) {
          logger.warn("Failed to add animation styles to reader document", e);
        }
      }
    }
  }, [readerContainerRef.current]);

  // --- Event Handlers ---

  /**
   * Toggles fullscreen mode for the reader
   */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      readerContainerRef.current?.requestFullscreen().catch((err) => {
        logger.error(`Error attempting to enable fullscreen:`, err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  /**
   * Toggles the visibility of the settings panel.
   */
  const toggleSettings = useCallback(() => {
    setShowSettings((prev: boolean) => !prev);
  }, [setShowSettings]);

  /**
   * Closes the reader view
   */
  const handleClose = useCallback(() => {
    chrome.runtime
      .sendMessage({
        type: "READER_MODE_CHANGED",
        isActive: false,
      })
      .catch((error) =>
        logger.warn("Failed to send READER_MODE_CHANGED message:", error),
      );

    document.dispatchEvent(new CustomEvent("READLITE_TOGGLE_INTERNAL"));
  }, []);

  /**
   * Handles the download of the article as Markdown.
   */
  const handleMarkdownDownload = useCallback(() => {
    if (article?.title && article.content) {
      try {
        exportAsMarkdown(article.title, article.content);
      } catch (error) {
        logger.error(`Export to Markdown failed:`, error);
      }
    }
  }, [article]);

  // --- Auto-scroll functionality ---

  // Toggle auto-scroll
  const toggleAutoScroll = useCallback(() => {
    setIsAutoScrolling((prev) => !prev);
  }, []);

  // Initialize auto-scroll when isAutoScrolling state changes
  useEffect(() => {
    const scrollContainer = readerColumnRef.current;
    if (!scrollContainer) return;

    // Calculate average reading speed (approximately 200-250 words per minute for an average reader)
    // Assuming an average of 5 characters per word and 80 characters per line
    // This means approximately 2.5-3 lines per second or roughly 1-2 pixels per 16ms frame
    // We'll make this adjustable later for different reading speeds

    // Clear existing interval if any
    if (autoScrollIntervalRef.current) {
      window.clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }

    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (isAutoScrolling) {
      // Start auto-scrolling
      const autoScrollFrame = () => {
        if (scrollContainer && !isDraggingRef.current) {
          scrollContainer.scrollBy({
            top: autoScrollSpeed,
            behavior: "auto", // Using 'auto' for smoother continuous scrolling
          });
        }
      };

      // Use requestAnimationFrame for smoother scrolling
      let lastTime = 0;
      const animateScroll = (timestamp: number) => {
        if (!isAutoScrolling) {
          if (animationFrameRef.current) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          return;
        }

        const elapsed = timestamp - lastTime;

        // Only update scroll position every 16ms (approximately 60fps)
        if (elapsed >= 16) {
          lastTime = timestamp;
          autoScrollFrame();
        }

        animationFrameRef.current = requestAnimationFrame(animateScroll);
      };

      animationFrameRef.current = requestAnimationFrame(animateScroll);

      // Pause auto-scroll when user manually scrolls
      const pauseOnUserScroll = () => {
        if (isAutoScrolling) {
          setIsAutoScrolling(false);
        }
      };

      scrollContainer.addEventListener("wheel", pauseOnUserScroll);
      scrollContainer.addEventListener("touchmove", pauseOnUserScroll);

      return () => {
        scrollContainer.removeEventListener("wheel", pauseOnUserScroll);
        scrollContainer.removeEventListener("touchmove", pauseOnUserScroll);

        // Clean up when unmounting or changing state
        if (animationFrameRef.current) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }
  }, [isAutoScrolling, autoScrollSpeed]);

  // Stop auto-scrolling when the Reader component will unmount or be hidden
  useEffect(() => {
    const stopAutoScroll = () => {
      if (isAutoScrolling) {
        setIsAutoScrolling(false);
      }

      if (autoScrollIntervalRef.current) {
        window.clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }

      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    // Listen for visibility change to stop auto-scrolling when tab is hidden
    const handleVisibilityChange = () => {
      if (document.hidden && isAutoScrolling) {
        setIsAutoScrolling(false);
      }
    };

    // Listen for page unload to clean up
    const handleBeforeUnload = () => {
      stopAutoScroll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopAutoScroll();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isAutoScrolling]);

  // --- Conditional Rendering ---

  // Handle loading state
  if (isLoading) {
    return (
      <ThemeProvider currentTheme={theme}>
        <div
          className="flex justify-center items-center h-screen w-screen bg-primary text-primary"
          data-theme={theme}
        >
          <div className="flex flex-col items-center">
            <div className="mb-4 animate-pulse">
              <BookOpenIcon className="w-16 h-16 text-current" />
            </div>
            <p className="text-current font-medium">{t("extractingArticle")}</p>
            <div className="mt-4 w-16 h-1 bg-accent/20 rounded-full overflow-hidden">
              <div className="h-full bg-accent w-1/2 animate-loading"></div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Handle error state (article not extracted or other errors)
  if (!article || error) {
    return (
      <ThemeProvider currentTheme={theme}>
        <div
          className="flex justify-center items-center h-screen w-screen bg-primary text-primary"
          data-theme={theme}
        >
          <div className="flex flex-col items-center max-w-md mx-auto p-4 rounded-lg">
            <div className="mb-4 text-error">
              <XCircleIcon className="w-16 h-16 text-current" />
            </div>
            <p className="text-current text-center font-medium">
              {error || t("couldNotExtract")}
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-md transition-colors"
            >
              {t("returnToPage")}
            </button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // --- Main Render ---

  return (
    <ThemeProvider currentTheme={theme}>
      <ReadingProgress />
      {/* Inline Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-[9999] bg-accent/20 pointer-events-none">
        <div
          className="h-full transition-all duration-150 ease-out bg-accent"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Main Container - the entire screen */}
      <div
        ref={readerContainerRef}
        className="readlite-reader-container bg-primary text-primary flex flex-col w-full h-full overflow-hidden relative"
        style={{
          ...(isFullscreen ? { userSelect: "text" } : {}),
        }}
        data-theme={theme}
        data-fullscreen={isFullscreen ? "true" : "false"}
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        {/* Content Container - holds the two columns */}
        <div className="flex flex-row flex-grow h-full">
          {/* Reader Column (left side) */}
          <div
            ref={readerColumnRef}
            className={`h-full overflow-y-auto relative box-border scrollbar-custom w-full ${isDraggingRef.current ? "" : "transition-all duration-200 ease-out"}`}
          >
            {/* Reader Content Area */}
            <ReaderContent
              ref={readerContentRef}
              settings={settings}
              article={article}
              detectedLanguage={detectedLanguage}
              error={error}
            />

            {/* Toolbar */}
            <ReaderToolbar
              handleMarkdownDownload={handleMarkdownDownload}
              toggleSettings={toggleSettings}
              handleClose={handleClose}
              toggleFullscreen={toggleFullscreen}
              isFullscreen={isFullscreen}
              settingsButtonRef={settingsButtonRef}
              showSettings={showSettings}
              isDragging={isDraggingRef.current}
              t={t}
              isAutoScrolling={isAutoScrolling}
              toggleAutoScroll={toggleAutoScroll}
            />
          </div>
        </div>

        {/* Text selection toolbar */}
        {selectionState.isActive && selectionState.rect && (
          <SelectionToolbar
            isVisible={selectionState.isActive}
            selectionRect={selectionState.rect}
            onHighlight={handleHighlight}
            onClose={() =>
              setSelectionState((prev) => ({ ...prev, isActive: false }))
            }
            highlightElement={selectionState.highlightElement}
            onRemoveHighlight={handleRemoveHighlight}
            onCopy={handleCopy}
          />
        )}

        {/* Settings Panel */}
        {showSettings && (
          <Settings
            onClose={() => setShowSettings(false)}
            buttonRef={settingsButtonRef}
          />
        )}
      </div>
    </ThemeProvider>
  );
};

export default Reader;
