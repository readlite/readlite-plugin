import React, { useState, useEffect, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"
import { ReaderProvider } from "./context/ReaderContext"
import { I18nProvider } from "./context/I18nContext"

import Reader from "./components/reader/Reader"
import { createRoot } from 'react-dom/client'
import { createLogger } from "./utils/logger"
import { AVAILABLE_THEMES, ThemeType, themeTokens } from "./config/theme"
import { 
  getPreferredTheme, 
  applyThemeGlobally,
  applyThemeStyles, 
  setupThemeChangeListener,
  saveTheme
} from "./utils/themeManager"

// Create content-specific loggers
const contentLogger = createLogger('content');
const uiLogger = createLogger('content-ui');
const isolatorLogger = createLogger('content-iframe');

// --- Config --- 

// Content script configuration
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_idle"
}

// Set the content script world directly (won't be included in manifest)
// @ts-ignore - This is a Plasmo-specific configuration
export const world = "ISOLATED"

// --- Types --- 

// Define types for messages this script might receive or send
// Based on types used in background.ts
interface ReaderModeChangedMessage { type: 'READER_MODE_CHANGED'; isActive: boolean; }
interface ContentScriptReadyMessage { type: 'CONTENT_SCRIPT_READY'; }
interface ActivateReaderMessage { type: 'ACTIVATE_READER'; }
interface DeactivateReaderMessage { type: 'DEACTIVATE_READER'; }
interface ToggleReaderMessage { type: 'TOGGLE_READER'; }

// Type for messages potentially received from background
type BackgroundMessage = 
  | ActivateReaderMessage
  | DeactivateReaderMessage
  | ToggleReaderMessage
  | { type: string; [key: string]: any };

// Types for Plasmo API
interface PlasmoRenderArgs {
  anchor: {
    element: Element;
    type: string;
  };
  createRootContainer: () => Promise<Element | null>;
}

// Add type declaration for the iframe window interface
interface IframeWindow extends Window {
  updateTheme?: (newTheme: string) => void;
}

// Global variables to track iframe and root
let iframeRoot: any = null;
let iframeElement: HTMLIFrameElement | null = null;

// Function to ensure the iframe theme is synchronized with the application theme
function syncThemeToIframe(theme: ThemeType) {
  if (!iframeElement || !iframeElement.contentDocument) {
    isolatorLogger.warn("Cannot sync theme to iframe: iframe not available");
    return;
  }
  
  // Apply the theme to the iframe document using the renamed function
  applyThemeGlobally(theme);
  
  // Save the theme settings and notify other windows
  saveTheme(theme);
  
  // Send to the iframe via postMessage
  try {
    if (iframeElement.contentWindow) {
      iframeElement.contentWindow.postMessage({ type: 'THEME_CHANGE', theme }, '*');
    }
  } catch (error) {
    isolatorLogger.error("Failed to post theme message to iframe", error);
  }
  
  // Also need to notify the Readlite application itself
  try {
    // Trigger a custom event on the top-level document
    document.dispatchEvent(new CustomEvent('READLITE_THEME_CHANGED', { 
      detail: { theme } 
    }));
  } catch (error) {
    isolatorLogger.error("Failed to dispatch theme changed event", error);
  }
}

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
    setIsActive(prevState => {
      const newState = !prevState;
      uiLogger.info(`Reader mode is now: ${newState ? 'Active' : 'Inactive'}`);
      
      // Notify background script about the state change
      chrome.runtime.sendMessage<ReaderModeChangedMessage>({ 
        type: "READER_MODE_CHANGED", 
        isActive: newState 
      }).catch(error => {
        uiLogger.warn("Failed to send READER_MODE_CHANGED message:", error);
      });
      
      // Directly control iframe visibility based on state
      if (newState) {
        showReaderMode();
      } else {
        hideReaderMode();
      }
      
      return newState;
    });
  }

  /**
   * Show reader mode and hide original page
   */
  const showReaderMode = () => {
    // Create iframe if it doesn't exist yet
    if (!iframeElement) {
      contentLogger.info("Creating iframe for reader mode");
      createIframe();
    }
    
    // Only proceed if iframe exists
    if (!iframeElement) {
      contentLogger.warn("showReaderMode called but iframe does not exist");
      return;
    }

    // Verify iframe is still in DOM
    const iframeCheck = document.getElementById("readlite-iframe-container");
    if (!iframeCheck) {
      contentLogger.error("Iframe reference exists but element not found in DOM - recreating");
      createIframe();
      if (!iframeElement) return;
    }

    // Debug check contentDocument
    try {
      if (iframeElement.contentDocument) {
        contentLogger.info("iframe contentDocument is accessible");
      } else {
        contentLogger.warn("iframe contentDocument is null");
      }
    } catch (e) {
      contentLogger.error("Error accessing iframe contentDocument:", e);
    }

    // Show iframe
    iframeElement.style.display = 'block';
    
    // Disable original page scrolling
    document.documentElement.classList.add('readlite-active');
    document.body.style.overflow = 'hidden';
    
    contentLogger.info("Reader mode displayed");
  }

  /**
   * Hide reader mode and show original page
   */
  const hideReaderMode = () => {
    // Only proceed if iframe exists
    if (!iframeElement) {
      contentLogger.warn("hideReaderMode called but iframe does not exist");
      return;
    }
    
    // Hide iframe but don't remove it
    iframeElement.style.display = 'none';
    
    // Restore original page scrolling
    document.documentElement.classList.remove('readlite-active');
    document.body.style.overflow = '';
    
    contentLogger.info("Reader mode hidden");
  }

  // 1. Effect for toggle event listener
  useEffect(() => {
    const handleInternalToggleEvent = () => {
      uiLogger.info("Received internal toggle event.");
      toggleReaderMode();
    };
    
    document.addEventListener('READLITE_TOGGLE_INTERNAL', handleInternalToggleEvent);
    
    return () => {
      document.removeEventListener('READLITE_TOGGLE_INTERNAL', handleInternalToggleEvent);
    };
  }, []);
  
  // 2. Effect for message handling
  useEffect(() => {
    const handleBackgroundMessages = (
      message: BackgroundMessage, 
      sender: chrome.runtime.MessageSender, 
      sendResponse: (response?: any) => void
    ): boolean => { 
      uiLogger.info(`Received message from background script: ${message.type}`);
      
      switch (message.type) {
        case 'ACTIVATE_READER':
          if (!isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;
        
        case 'DEACTIVATE_READER':
          if (isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;
          
        case 'TOGGLE_READER':
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
    chrome.runtime.sendMessage<ContentScriptReadyMessage>({ type: "CONTENT_SCRIPT_READY" })
      .catch(error => {
        uiLogger.warn("Failed to send CONTENT_SCRIPT_READY message:", error);
      });
    
    // Inject CSS for reader mode
    const styleElement = document.createElement('style');
    styleElement.id = 'readlite-global-styles';
    styleElement.textContent = `
      html.readlite-active {
        overflow: hidden !important;
      }
      
      #readlite-iframe-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
        z-index: 2147483645;
        background-color: var(--readlite-bg-primary);
        display: none;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Cleanup function - only runs when component is completely unmounted
    return () => {
      uiLogger.info("Cleanup from unmounting content script.");
      
      // Remove style elements
      const style = document.getElementById('readlite-global-styles');
      if (style) {
        document.head.removeChild(style);
      }
      
      // Remove iframe only when component unmounts, not when toggling visibility
      removeIframe();
      
      // Reset page state
      document.documentElement.classList.remove('readlite-active');
      document.body.style.overflow = '';
    };
  }, []); // Empty dependency array - runs once on mount, cleanup on unmount
  
  // Initially, component should return null because rendering is done inside the iframe
  if (!isActive) {
    return null;
  }
  
  return (
    <div className="readlite-reader-container">
      <I18nProvider>
          <ReaderProvider>
            <Reader />
          </ReaderProvider>
      </I18nProvider>
    </div>
  );
}

/**
 * Create iframe to host the reader mode UI
 */
function createIframe() {
  // If iframe already exists, don't create a duplicate
  if (document.getElementById("readlite-iframe-container")) {
    isolatorLogger.info("iframe already exists, reusing existing iframe");
    return;
  }

  // Get preferred theme
  const preferredTheme = getPreferredTheme();

  // Create iframe with explicitly NO sandbox restrictions to allow full access
  const iframe = document.createElement('iframe');
  iframe.id = 'readlite-iframe-container';
  iframe.style.display = 'none'; // Initially hidden
  iframe.style.backgroundColor = themeTokens[preferredTheme].bg.primary; // Use theme colors to prevent white flash
  
  // Add to document
  document.body.appendChild(iframe);
  isolatorLogger.info(`Created iframe container with theme: ${preferredTheme}`);
  
  // Verify iframe was added to DOM
  const iframeCheck = document.getElementById("readlite-iframe-container");
  if (!iframeCheck) {
    isolatorLogger.error("Failed to append iframe to body - iframe not found in DOM after creation");
    return;
  }
  
  // Save global reference
  iframeElement = iframe;
  
  // Set up iframe content with preferred theme
  setupIframeContent(iframe, preferredTheme);
}

/**
 * Sets up the basic HTML structure and mounts the React app inside the iframe.
 * Applies the initial theme to prevent flickering before React hydrates.
 * 
 * @param iframe The iframe element to set up.
 * @param theme The initial theme to apply.
 */
function setupIframeContent(iframe: HTMLIFrameElement, theme: ThemeType) {
  const doc = iframe.contentDocument; // Get the document once
  if (!doc) {
    isolatorLogger.error("Cannot setup iframe content: contentDocument is null");
    return;
  }
  
  // Use colors from the theme system
  const themeColors = themeTokens[theme];
  
  // Create complete HTML structure with minimal initial styles
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html class="${theme}" data-theme="${theme}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ReadLite Reader</title>
        <style>
          /* Base reset styles */
          html, body {
            all: initial !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            transition: background-color 0.3s ease, color 0.3s ease !important;
          }
          
          #readlite-root {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
        </style>
      </head>
      <body class="${theme}" data-theme="${theme}">
        <div id="readlite-root"></div>
      </body>
    </html>
  `);
  doc.close();
  
  // Apply initial theme styles directly to prevent flash of unstyled content
  applyThemeGlobally(theme);
  applyThemeStyles(doc, theme); // Use the non-null doc
  
  // Add Tailwind CSS
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    // First the main Tailwind CSS
    const tailwindLink = doc.createElement('link'); // Use doc
    tailwindLink.rel = 'stylesheet';
    tailwindLink.href = chrome.runtime.getURL('src/styles/tailwind.output.css');
    doc.head.appendChild(tailwindLink); // Use doc
    
    // Make sure tailwind loads before the app renders
    tailwindLink.onload = () => {
      isolatorLogger.info("Tailwind CSS loaded successfully");
      
      // Add additional fixes for theme consistency
      const fixesStyle = doc.createElement('style'); // Use doc
      fixesStyle.id = 'readlite-theme-fixes';
      fixesStyle.textContent = `
        /* Container styles */
        .readlite-reader-container {
          all: initial !important;
          display: block !important;
          width: 100% !important;
          height: 100% !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background-color: inherit !important;
          color: inherit !important;
          z-index: 2147483645 !important;
          overflow: hidden !important;
          background-color: var(--readlite-bg-secondary) !important;
          color: var(--readlite-text-primary) !important;
          transition: background-color 0.3s ease, color 0.3s ease !important;
        }
        
        /* Tailwind utility classes */
        .mx-auto {
          margin-left: auto !important;
          margin-right: auto !important;
        }
      `;
      doc.head.appendChild(fixesStyle); // Use doc
      
      // Set up theme update mechanism
      if (doc.defaultView) { // Use doc
        // Method to update the theme
        (doc.defaultView as IframeWindow).updateTheme = function(newTheme: string) {
          if (AVAILABLE_THEMES.includes(newTheme as ThemeType)) {
            applyThemeGlobally(newTheme as ThemeType);
            applyThemeStyles(doc, newTheme as ThemeType);
            
            // Sync back to the main application
            try {
              window.parent.postMessage({ type: 'IFRAME_THEME_UPDATED', theme: newTheme }, '*');
            } catch (e) {
              console.error('Failed to notify parent about theme update', e);
            }
          }
        };
      
        // Add message listener to handle messages from the parent window
        doc.defaultView.addEventListener('message', (event) => { // Use doc
          // Handle theme change messages
          if (event.data && event.data.type === 'THEME_CHANGE') {
            const theme = event.data.theme;
            if (AVAILABLE_THEMES.includes(theme as ThemeType)) {
              isolatorLogger.info(`Received theme change message: ${theme}`);
              applyThemeGlobally(theme as ThemeType);
              applyThemeStyles(doc, theme as ThemeType);
            }
          }
        });
        
        // Set up theme change listener
        const cleanupListener = setupThemeChangeListener(doc, (newTheme) => { // Use doc
          isolatorLogger.info(`Theme changed via storage event: ${newTheme}`);
        });
        
        // Add cleanup function
        doc.defaultView.addEventListener('unload', cleanupListener); // Use doc
      }
      
      // Now render the React component after Tailwind CSS is loaded
      renderReactApp(doc.body, theme); // Use doc.body
    };
  } else {
    // Fallback if chrome.runtime isn't available
    renderReactApp(doc.body, theme); // Use doc.body
  }
}

/**
 * Mounts the React Reader application into the given container element.
 * 
 * @param container The HTML element to mount the React app into.
 * @param initialTheme The initial theme to pass to the ThemeProvider.
 */
function renderReactApp(container: HTMLElement, initialTheme: ThemeType) {
  isolatorLogger.info("Starting renderReactApp with container:", container?.tagName);

  if (!container) {
    isolatorLogger.error("Cannot render React app: container is null");
    return;
  }
  
  // Debug container HTML
  isolatorLogger.info("Container HTML structure:", container.innerHTML.substring(0, 100));
  
  const rootElement = container.querySelector<HTMLElement>('#readlite-root'); // Use querySelector for type safety
  if (!rootElement) {
    isolatorLogger.error("Cannot find readlite-root element in iframe");
    
    // Attempt recovery by checking if we need to create the element
    try {
      isolatorLogger.info("Attempting recovery by creating #readlite-root element");
      const newRoot = document.createElement('div');
      newRoot.id = 'readlite-root';
      newRoot.style.width = '100%';
      newRoot.style.height = '100%';
      container.appendChild(newRoot);
      isolatorLogger.info("Created new #readlite-root element");
      
      // Try again with newly created element
      const recoveredRoot = container.querySelector<HTMLElement>('#readlite-root');
      if (recoveredRoot) {
        isolatorLogger.info("Recovery successful, proceeding with rendering");
        renderReactIntoRoot(recoveredRoot, initialTheme);
        return;
      }
    } catch (error) {
      isolatorLogger.error("Recovery attempt failed:", error);
    }
    return;
  }
  
  // If we found the root element, render into it
  renderReactIntoRoot(rootElement, initialTheme);
}

/**
 * Helper function to render React into a root element
 */
function renderReactIntoRoot(rootElement: HTMLElement, initialTheme: ThemeType) {
  isolatorLogger.info("Rendering React into root element");
  
  // Render React component
  try {
    iframeRoot = createRoot(rootElement);
    iframeRoot.render(
      <React.StrictMode>
        <I18nProvider>
            <ReaderProvider initialTheme={initialTheme}>
              <Reader />
            </ReaderProvider>
        </I18nProvider>
      </React.StrictMode>
    );
    isolatorLogger.info("React app rendered successfully inside iframe");
  } catch (error) {
    isolatorLogger.error("Failed to render Reader UI in iframe:", error);
    
    // Try simpler rendering as fallback
    try {
      isolatorLogger.info("Attempting simplified rendering as fallback");
      const simpleRoot = createRoot(rootElement);
      simpleRoot.render(<div>ReadLite Reader</div>);
      isolatorLogger.info("Fallback rendering succeeded");
    } catch (e) {
      isolatorLogger.error("Even simplified rendering failed:", e);
    }
  }
}

/**
 * Remove iframe
 */
function removeIframe() {
  // Clean up React root
  if (iframeRoot) {
    try {
      iframeRoot.unmount();
    } catch (error) {
      isolatorLogger.error("Error unmounting React root:", error);
    }
    iframeRoot = null;
  }
  
  // Remove iframe element
  if (iframeElement && iframeElement.parentNode) {
    iframeElement.parentNode.removeChild(iframeElement);
    isolatorLogger.info("Removed iframe container");
  }
  
  iframeElement = null;
}

// Custom getRootContainer function to provide entry point for Plasmo
export const getRootContainer = () => {
  return null;
}

// Custom render function
export const render = async ({ 
  anchor, 
  createRootContainer 
}: PlasmoRenderArgs) => {
  contentLogger.info('[Content Script] ReadLite content script initialized, waiting for activation');
  
  try {
    // Create virtual DOM root node for initialization
    const dummyRoot = document.createElement('div');
    dummyRoot.style.display = 'none';
    document.body.appendChild(dummyRoot);
    
    const root = createRoot(dummyRoot);
    root.render(<ContentScriptUI />);
  } catch (error) {
    contentLogger.error('[Content Script] Error initializing ContentScriptUI:', error);
  }
};

export default ContentScriptUI