import React from "react";
import { ReaderProvider } from "./context/ReaderContext";
import { I18nProvider } from "./context/I18nContext";

import Reader from "./components/reader/Reader";
import { createRoot } from "react-dom/client";
import { createLogger } from "./utils/logger";
import { getPreferredTheme, applyThemeStyles } from "./utils/themeManager";

// Create content-specific loggers
const contentLogger = createLogger("content");
const uiLogger = createLogger("content-ui");
const isolatorLogger = createLogger("content-iframe");

// --- Config ---

// Content script configuration
export const config = {
  matches: ["<all_urls>"],
  run_at: "document_idle",
};

// --- Types ---

// Define types for messages this script might receive or send
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

// Global variables to track state and containers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let readerRoot: any = null;
let readerContainer: HTMLElement | null = null;
let isActive = false;

/**
 * Toggles the reader mode state and notifies the background script.
 */
function toggleReaderMode() {
  uiLogger.info("Toggling reader mode...");
  isActive = !isActive;
  uiLogger.info(`Reader mode is now: ${isActive ? "Active" : "Inactive"}`);

  // Notify background script about the state change
  chrome.runtime
    .sendMessage<ReaderModeChangedMessage>({
      type: "READER_MODE_CHANGED",
      isActive: isActive,
    })
    .catch((error) => {
      uiLogger.warn("Failed to send READER_MODE_CHANGED message:", error);
    });

  // Directly control container visibility based on state
  if (isActive) {
    showReaderMode();
  } else {
    hideReaderMode();
  }
}

/**
 * Show reader mode and hide original page
 */
function showReaderMode() {
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
}

/**
 * Hide reader mode and show original page
 */
function hideReaderMode() {
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
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessages(
  message: BackgroundMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
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
}

/**
 * Handle internal toggle event
 */
function handleInternalToggleEvent() {
  uiLogger.info("Received internal toggle event.");
  toggleReaderMode();
}

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
        isolatorLogger.info(
          "Tailwind CSS loaded successfully in Shadow DOM (via fetch)",
        );

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
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(
          I18nProvider,
          null,
          React.createElement(
            ReaderProvider,
            { initialTheme },
            React.createElement(Reader),
          ),
        ),
      ),
    );
    isolatorLogger.info("React app rendered successfully inside Shadow DOM");
  } catch (error) {
    isolatorLogger.error("Failed to render Reader UI:", error);
  }
}

/**
 * Remove container (exported for potential future use/testing)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
}

/**
 * Initialize the content script
 */
function initialize() {
  contentLogger.info("[Content Script] ReadLite content script initialized");

  // Add event listeners
  document.addEventListener(
    "READLITE_TOGGLE_INTERNAL",
    handleInternalToggleEvent,
  );
  chrome.runtime.onMessage.addListener(handleBackgroundMessages);

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
}

// Run initialization
initialize();
