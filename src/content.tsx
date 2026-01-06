import React, { useState, useEffect } from "react";
import type { PlasmoCSConfig } from "plasmo";
import { ReaderProvider } from "./context/ReaderContext";
import { I18nProvider } from "./context/I18nContext";

import Reader from "./components/reader/Reader";
import { createRoot, Root } from "react-dom/client";
import { createLogger } from "./utils/logger";
import { ThemeType } from "./config/theme";
import {
  getPreferredTheme,
  applyThemeStyles,
} from "./utils/themeManager";

// Create content-specific loggers
const contentLogger = createLogger("content");
const uiLogger = createLogger("content-ui");
const isolatorLogger = createLogger("content-iframe");

// --- Config ---

// Content script configuration
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle",
};

// Set the content script world directly (won't be included in manifest)
// @ts-expect-error - This is a Plasmo-specific configuration
export const world = "ISOLATED";

// --- Types ---

// Define types for messages this script might receive or send
// Based on types used in background.ts
interface ReaderModeChangedMessage {
  type: "READER_MODE_CHANGED";
  isActive: boolean;
}
interface ContentScriptReadyMessage {
  type: "CONTENT_SCRIPT_READY";
}
interface ActivateReaderMessage {
  type: "ACTIVATE_READER";
}
interface DeactivateReaderMessage {
  type: "DEACTIVATE_READER";
}
interface ToggleReaderMessage {
  type: "TOGGLE_READER";
}

// Type for messages potentially received from background
type BackgroundMessage =
  | ActivateReaderMessage
  | DeactivateReaderMessage
  | ToggleReaderMessage
  | { type: string; [key: string]: unknown };

// Types for Plasmo API
interface PlasmoRenderArgs {
  anchor: {
    element: Element;
    type: string;
  };
  createRootContainer: () => Promise<Element | null>;
}

// Global variables to track shadow container and root
let readerRoot: Root | null = null;
let readerContainer: HTMLElement | null = null;

// Function to ensure the theme is synchronized
// function syncThemeToShadow(theme: ThemeType) { // unused
//   if (!shadowRoot) {
//     isolatorLogger.warn("Cannot sync theme: shadowRoot not available");
//     return;
//   }

//   // Apply the theme styles
//   applyThemeStyles(shadowRoot, theme);
  
//   // Update wrapper class
//   const wrapper = shadowRoot.querySelector('.readlite-theme-wrapper');
//   if (wrapper) {
//     AVAILABLE_THEMES.forEach(t => wrapper.classList.remove(t));
//     wrapper.classList.add(theme);
//     wrapper.setAttribute('data-theme', theme);
//   }

//   // Save the theme settings
//   saveTheme(theme);

//   // Also need to notify the Readlite application itself
//   try {
//     // Trigger a custom event on the top-level document
//     document.dispatchEvent(
//       new CustomEvent("READLITE_THEME_CHANGED", {
//         detail: { theme },
//       }),
//     );
//   } catch (error) {
//     isolatorLogger.error("Failed to dispatch theme changed event", error);
//   }
// }

/**
 * Content Script UI Component
 * Injected into the page, manages the reader mode state, and renders the Reader UI.
 */
const ContentScriptUI = () => {
  const [isActive, setIsActive] = useState(false);

  /**
   * Toggles the reader mode state and notifies the background script.
   */
  const toggleReaderMode = () => {
    uiLogger.info("Toggling reader mode...");
    setIsActive((prevState) => {
      const newState = !prevState;
      uiLogger.info(`Reader mode is now: ${newState ? "Active" : "Inactive"}`);

      // Notify background script about the state change
      chrome.runtime
        .sendMessage<ReaderModeChangedMessage>({
          type: "READER_MODE_CHANGED",
          isActive: newState,
        })
        .catch((error) => {
          uiLogger.warn("Failed to send READER_MODE_CHANGED message:", error);
        });

      // Directly control container visibility based on state
      if (newState) {
        showReaderMode();
      } else {
        hideReaderMode();
      }

      return newState;
    });
  };

  /**
   * Show reader mode and hide original page
   */
  const showReaderMode = () => {
    // Create container if it doesn't exist yet
    if (!readerContainer) {
      contentLogger.info("Creating container for reader mode");
      createReaderContainer();
    }

    // Only proceed if container exists
    if (!readerContainer) {
      contentLogger.warn("showReaderMode called but container does not exist");
      return;
    }

    // Show container
    readerContainer.style.display = "block";

    // Disable original page scrolling
    document.documentElement.classList.add("readlite-active");
    document.body.style.overflow = "hidden";

    contentLogger.info("Reader mode displayed");
  };

  /**
   * Hide reader mode and show original page
   */
  const hideReaderMode = () => {
    // Only proceed if container exists
    if (!readerContainer) {
      contentLogger.warn("hideReaderMode called but container does not exist");
      return;
    }

    // Hide container but don't remove it
    readerContainer.style.display = "none";

    // Restore original page scrolling
    document.documentElement.classList.remove("readlite-active");
    document.body.style.overflow = "";

    contentLogger.info("Reader mode hidden");
  };

  // 1. Effect for toggle event listener
  useEffect(() => {
    const handleInternalToggleEvent = () => {
      uiLogger.info("Received internal toggle event.");
      toggleReaderMode();
    };

    document.addEventListener(
      "READLITE_TOGGLE_INTERNAL",
      handleInternalToggleEvent,
    );

    return () => {
      document.removeEventListener(
        "READLITE_TOGGLE_INTERNAL",
        handleInternalToggleEvent,
      );
    };
  }, []);

  // 2. Effect for message handling
  useEffect(() => {
    const handleBackgroundMessages = (
      message: BackgroundMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ): boolean => {
      uiLogger.info(`Received message from background script: ${message.type}`);

      switch (message.type) {
        case "ACTIVATE_READER":
          if (!isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;

        case "DEACTIVATE_READER":
          if (isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;

        case "TOGGLE_READER":
          toggleReaderMode();
          sendResponse({ success: true });
          break;
      }

      return false; // No async processing
    };

    chrome.runtime.onMessage.addListener(handleBackgroundMessages);

    return () => {
      if (chrome.runtime?.onMessage?.hasListener(handleBackgroundMessages)) {
        chrome.runtime.onMessage.removeListener(handleBackgroundMessages);
      }
    };
  }, [isActive]);

  // 3. Effect for initial setup and content script ready notification
  useEffect(() => {
    // Notify background script that content script is ready
    uiLogger.info("Sending CONTENT_SCRIPT_READY message.");
    chrome.runtime
      .sendMessage<ContentScriptReadyMessage>({ type: "CONTENT_SCRIPT_READY" })
      .catch((error) => {
        uiLogger.warn("Failed to send CONTENT_SCRIPT_READY message:", error);
      });

    // Inject CSS for reader mode (global styles for body lock)
    const styleElement = document.createElement("style");
    styleElement.id = "readlite-global-styles";
    styleElement.textContent = `
      html.readlite-active {
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(styleElement);

    // Cleanup function - only runs when component is completely unmounted
    return () => {
      uiLogger.info("Cleanup from unmounting content script.");

      // Remove style elements
      const style = document.getElementById("readlite-global-styles");
      if (style) {
        document.head.removeChild(style);
      }

      // Remove container only when component unmounts
      removeReaderContainer();

      // Reset page state
      document.documentElement.classList.remove("readlite-active");
      document.body.style.overflow = "";
    };
  }, []); // Empty dependency array - runs once on mount, cleanup on unmount

  // Initially, component should return null because rendering is done inside the shadow dom
  if (!isActive) {
    return null;
  }

  return (
    <div className="readlite-reader-container-placeholder">
      <I18nProvider>
        <ReaderProvider>
          <Reader />
        </ReaderProvider>
      </I18nProvider>
    </div>
  );
};

/**
 * Create Shadow DOM container to host the reader mode UI
 */
function createReaderContainer() {
  // If container already exists, don't create a duplicate
  if (document.getElementById("readlite-container")) {
    isolatorLogger.info("container already exists, reusing existing container");
    return;
  }

  // Get preferred theme
  const preferredTheme = getPreferredTheme();

  // Create host element
  const container = document.createElement("div");
  container.id = "readlite-container";
  container.style.display = "none"; // Initially hidden
  
  // Add to document
  document.body.appendChild(container);
  isolatorLogger.info(`Created shadow host container`);

  // Attach Shadow DOM
  const shadow = container.attachShadow({ mode: "open" });
  
  // Save global references
  readerContainer = container;
  // shadowRoot = shadow;

  // Set up shadow content
  setupShadowContent(shadow, preferredTheme);
}

/**
 * Sets up the Shadow DOM structure and mounts the React app.
 */
function setupShadowContent(shadow: ShadowRoot, theme: ThemeType) {
  // 1. Create Wrapper for Theme Scoping
  const wrapper = document.createElement("div");
  wrapper.className = `readlite-theme-wrapper ${theme}`;
  wrapper.setAttribute("data-theme", theme);
  
  // 2. Create React root node
  const rootDiv = document.createElement("div");
  rootDiv.id = "readlite-root";
  wrapper.appendChild(rootDiv);

  // 3. Append wrapper to shadow
  shadow.appendChild(wrapper);

  // 4. Apply Theme Styles
  applyThemeStyles(shadow, theme);

  // 5. Add Tailwind CSS
  if (typeof chrome !== "undefined" && chrome.runtime) {
    const cssUrl = chrome.runtime.getURL("src/styles/tailwind.output.css");
    
    fetch(cssUrl)
      .then((response) => response.text())
      .then((cssText) => {
        const style = document.createElement("style");
        style.textContent = cssText;
        shadow.appendChild(style);
        isolatorLogger.info("Tailwind CSS loaded successfully in Shadow DOM (via fetch)");

        // Add additional fixes
        const fixesStyle = document.createElement("style");
        fixesStyle.textContent = `
          :host {
            all: initial;
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2147483645;
          }
        `;
        shadow.appendChild(fixesStyle);

        // Render React
        renderReactIntoRoot(rootDiv, theme);
      })
      .catch((error) => {
        isolatorLogger.error("Failed to load Tailwind CSS:", error);
        // Fallback: try to render anyway
        renderReactIntoRoot(rootDiv, theme);
      });
  } else {
    renderReactIntoRoot(rootDiv, theme);
  }
}

/**
 * Helper function to render React into a root element
 */
function renderReactIntoRoot(
  rootElement: HTMLElement,
  initialTheme: ThemeType,
) {
  isolatorLogger.info("Rendering React into root element");

  // Render React component
  try {
    readerRoot = createRoot(rootElement);
    readerRoot.render(
      <React.StrictMode>
        <I18nProvider>
          <ReaderProvider initialTheme={initialTheme}>
            <Reader />
          </ReaderProvider>
        </I18nProvider>
      </React.StrictMode>,
    );
    isolatorLogger.info("React app rendered successfully inside Shadow DOM");
  } catch (error) {
    isolatorLogger.error("Failed to render Reader UI:", error);
  }
}

/**
 * Remove container
 */
function removeReaderContainer() {
  // Clean up React root
  if (readerRoot) {
    try {
      readerRoot.unmount();
    } catch (error) {
      isolatorLogger.error("Error unmounting React root:", error);
    }
    readerRoot = null;
  }

  // Remove container element
  if (readerContainer && readerContainer.parentNode) {
    readerContainer.parentNode.removeChild(readerContainer);
    isolatorLogger.info("Removed reader container");
  }

  readerContainer = null;
  // shadowRoot = null;
}

// Custom getRootContainer function to provide entry point for Plasmo
export const getRootContainer = () => {
  return null;
};

// Custom render function
export const render = async (_props: PlasmoRenderArgs) => {
  contentLogger.info(
    "[Content Script] ReadLite content script initialized, waiting for activation",
  );

  try {
    // Create virtual DOM root node for initialization
    const dummyRoot = document.createElement("div");
    dummyRoot.style.display = "none";
    document.body.appendChild(dummyRoot);

    const root = createRoot(dummyRoot);
    root.render(<ContentScriptUI />);
  } catch (error) {
    contentLogger.error(
      "[Content Script] Error initializing ContentScriptUI:",
      error,
    );
  }
};

export default ContentScriptUI;
