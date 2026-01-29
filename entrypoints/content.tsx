import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { browser } from 'wxt/browser';
import React, { useEffect, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { ReaderProvider } from "@/context/ReaderContext";
import Reader from "@/components/reader/Reader";
import { createLogger } from "@/utils/logger";
import {
  getPreferredTheme,
  applyThemeGlobally,
  applyThemeStyles,
  setupThemeChangeListener,
  saveTheme,
} from "@/utils/themeManager";
import globalCssUrl from "@/styles/global.css?url";

// Create content-specific loggers
const contentLogger = createLogger("content");
const uiLogger = createLogger("content-ui");

// --- Types ---

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

type BackgroundMessage =
  | ActivateReaderMessage
  | DeactivateReaderMessage
  | ToggleReaderMessage
  | { type: string; [key: string]: any };

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  cssInjectionMode: "manual",
  async main(ctx) {
    contentLogger.info("[Content Script] ReadLite content script initialized");

    // Track state
    let uiMounted = false;
    let uiVisible = false;
    let shadowRoot: ShadowRoot | null = null;
    let mountPoint: HTMLElement | null = null;
    let reactRoot: Root | null = null;

    // Define the UI using WXT's Shadow Root helper
    const ui = await createShadowRootUi(ctx, {
      name: 'readlite-reader',
      position: 'inline', // We'll manage position via CSS
      anchor: 'body',
      append: 'last',
      mode: 'open',
      isolateEvents: true, // Stop events from bubbling out
      onMount: (uiContainer, shadow, shadowHost) => {
        contentLogger.info("Mounting ShadowRoot UI");
        shadowRoot = shadow;
        mountPoint = uiContainer;

        // Ensure uiContainer takes full width/height of the shadow host
        Object.assign(uiContainer.style, {
          width: '100%',
          height: '100%'
        });
        
        // 1. Inject Styles
        // Inject Tailwind/Global CSS
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = (browser.runtime as any).getURL(globalCssUrl);
        shadow.appendChild(link);

        // Inject container styles to the Shadow Host to ensure it covers the screen
        Object.assign(shadowHost.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100vw',
          height: '100vh',
          zIndex: '2147483647',
          display: 'none', // Hidden by default
          isolation: 'isolate',
        });

        // 2. Setup Theme
        const preferredTheme = getPreferredTheme();
        
        // Apply theme to Shadow Root
        // We pass the uiContainer for class/variable application (so Tailwind works)
        // We pass shadow for style tag injection
        applyThemeGlobally(preferredTheme, uiContainer);
        applyThemeStyles(shadow, preferredTheme);

        // 3. Mount React
        // Create a dedicated root element inside the UI container to avoid React warnings
        // about mounting directly on the container (which might be treated like a body)
        const appRoot = document.createElement("div");
        appRoot.id = "readlite-app-root";
        appRoot.style.width = "100%";
        appRoot.style.height = "100%";
        uiContainer.appendChild(appRoot);

        reactRoot = createRoot(appRoot);
        reactRoot.render(
          <React.StrictMode>
             {/* Wrap in a container to ensure full height/width inside mount point */}
            <div id="readlite-root" className="w-full h-full">
              <ReaderProvider initialTheme={preferredTheme}>
                <Reader />
              </ReaderProvider>
            </div>
          </React.StrictMode>
        );

        // 4. Listen for theme changes from the app and update Shadow DOM
        // The React app might update theme via context, which saves to localStorage
        // We listen for that storage event to update CSS variables on the ShadowRoot
        const storageListener = (event: StorageEvent) => {
            if (event.key === "readlite_theme" && event.newValue) {
                // Import ThemeType dynamically or cast if needed, but we imported it at top level
                // However, we need to ensure we use the imported symbols
                // We'll rely on string matching for simplicity or cast
                const newTheme = event.newValue as any; // Cast to avoid type issues if needed
                applyThemeGlobally(newTheme, uiContainer);
                applyThemeStyles(shadow, newTheme);
            }
        };
        window.addEventListener("storage", storageListener);
        
        // Return cleanup function
        return () => {
             window.removeEventListener("storage", storageListener);
             if (reactRoot) {
                 reactRoot.unmount();
             }
        }
      },
      onRemove: () => {
        contentLogger.info("Removing ShadowRoot UI");
        shadowRoot = null;
        mountPoint = null;
        reactRoot = null;
        uiMounted = false;
        uiVisible = false;
      }
    });

    // Helper to show/hide the UI
    const setUiVisibility = (visible: boolean) => {
        if (!uiMounted && visible) {
            ui.mount();
            uiMounted = true;
        }

        if (uiMounted && ui.uiContainer) {
             // The wrapper is the Shadow Host
             const shadowHost = ui.uiContainer.getRootNode() as ShadowRoot; 
             
             // Let's use the variable 'shadowRoot' we captured in onMount.
             if (shadowRoot) {
                 const host = shadowRoot.host as HTMLElement;
                 if (host) {
                     host.style.display = visible ? 'block' : 'none';
                 }
             }
        }

        uiVisible = visible;
        
        // Toggle body scroll
        if (visible) {
            document.documentElement.style.overflow = 'hidden';
            document.documentElement.classList.add('readlite-active');
        } else {
             document.documentElement.style.overflow = '';
             document.documentElement.classList.remove('readlite-active');
        }

        // Notify Background
        // WXT's browser.runtime.sendMessage is promise-based and handles errors
        browser.runtime.sendMessage({
          type: "READER_MODE_CHANGED",
          isActive: visible,
        }).catch(() => {});
    };

    const toggleReader = () => {
        setUiVisibility(!uiVisible);
    };

    // Listen for messages
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
         const bgMessage = message as BackgroundMessage;
         contentLogger.info(`[Content Script] Received message: ${bgMessage.type}`);
         switch (bgMessage.type) {
        case "ACTIVATE_READER":
          contentLogger.info(`[Content Script] Activating reader`);
          if (!uiVisible) setUiVisibility(true);
          sendResponse({ success: true });
          return true;
        case "DEACTIVATE_READER":
          contentLogger.info(`[Content Script] Deactivating reader`);
          if (uiVisible) setUiVisibility(false);
          sendResponse({ success: true });
          return true;
        case "TOGGLE_READER":
          contentLogger.info(`[Content Script] Toggling reader, current visibility: ${uiVisible}`);
          toggleReader();
          sendResponse({ success: true });
          return true;
        default:
          return false;
      }
    };
    browser.runtime.onMessage.addListener(handleMessage as any);

    // Listen for internal toggle event (from React app close button)
    const handleInternalToggle = () => {
        toggleReader();
    };
    document.addEventListener("READLITE_TOGGLE_INTERNAL", handleInternalToggle);

    // Notify ready
    browser.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" }).catch(() => {});
    
    // Return cleanup for the content script
    return () => {
        browser.runtime.onMessage.removeListener(handleMessage as any);
        document.removeEventListener("READLITE_TOGGLE_INTERNAL", handleInternalToggle);
        ui.remove();
        document.documentElement.style.overflow = '';
        document.documentElement.classList.remove('readlite-active');
    };
  }
});
