import { defineBackground } from 'wxt/sandbox';
import { browser } from 'wxt/browser';
import {
  applyLogSettings,
  createLogger,
    LOG_CONSOLE_STORAGE_KEY,
    LOG_LEVEL_STORAGE_KEY,
} from "@/utils/logger";

const mainLogger = createLogger("background");
const messageLogger = createLogger("background-messages");

// Welcome page (on first install)
browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  try {
    const url =
      (browser.runtime as any)?.getURL?.("welcome.html") || "welcome.html";
    await browser.tabs.create({ url });
  } catch (e) {
    mainLogger.warn("Failed to open welcome page", e);
  }
});

// --- Constants ---

// Track which tabs have reader mode active
const activeTabsMap = new Map<number, boolean>();

// Colors for the extension icon (Used by updateIconState)
const ACTIVE_COLOR: [number, number, number, number] = [187, 156, 216, 255]; // #BB9CD8
const INACTIVE_COLOR: [number, number, number, number] = [216, 216, 240, 255]; // #D8D8F0
const BADGE_TEXT_COLOR: [number, number, number, number] = [255, 255, 255, 255]; // White

// --- Types ---

interface ToggleReaderModeMessage {
  type: "TOGGLE_READER_MODE";
}
interface ContentScriptReadyMessage {
  type: "CONTENT_SCRIPT_READY";
}
interface ReaderModeChangedMessage {
  type: "READER_MODE_CHANGED";
  isActive: boolean;
}

type BackgroundMessage =
  | ToggleReaderModeMessage
  | ContentScriptReadyMessage
  | ReaderModeChangedMessage;

export default defineBackground(() => {
  const loadLogSettings = async () => {
    try {
      const stored = await browser.storage.local.get([
        LOG_LEVEL_STORAGE_KEY,
        LOG_CONSOLE_STORAGE_KEY,
      ]);
      applyLogSettings({
        level:
          typeof stored[LOG_LEVEL_STORAGE_KEY] === "number"
            ? stored[LOG_LEVEL_STORAGE_KEY]
            : undefined,
        console:
          typeof stored[LOG_CONSOLE_STORAGE_KEY] === "boolean"
            ? stored[LOG_CONSOLE_STORAGE_KEY]
            : undefined,
      });
    } catch {
      // Ignore logging config failures; defaults remain in effect.
    }
  };

  void loadLogSettings();
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const nextLevel = changes[LOG_LEVEL_STORAGE_KEY]?.newValue;
    const nextConsole = changes[LOG_CONSOLE_STORAGE_KEY]?.newValue;
    applyLogSettings({
      level: typeof nextLevel === "number" ? nextLevel : undefined,
      console: typeof nextConsole === "boolean" ? nextConsole : undefined,
    });
  });

  // --- Main Message Listener ---

  /**
   * Handles incoming messages from content scripts.
   */
  browser.runtime.onMessage.addListener(
    ((message: unknown, sender: any, sendResponse: any) => {
      // Cast message to expected type
      const bgMessage = message as BackgroundMessage;
      
      const tabId = sender.tab?.id;
      if (!tabId) {
        messageLogger.warn(
          `Received message type "${bgMessage.type}" without sender tab ID. Ignoring.`,
        );
        return false;
      }

      switch (bgMessage.type) {
        case "CONTENT_SCRIPT_READY":
          handleContentScriptReady(sender, sendResponse);
          return true;
        case "READER_MODE_CHANGED":
          handleReaderModeChanged(bgMessage.isActive, tabId, sendResponse);
          return true;
        case "TOGGLE_READER_MODE":
          handleToggleReaderMode(sender.tab);
          break;
        default:
          return false;
      }

      return false;
    }) as any,
  );

  // --- Browser Event Listeners ---

  /**
   * Listens for tab updates (e.g., page loads) to reset the icon state.
   */
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      mainLogger.info(`Tab ${tabId} updated (status: complete), resetting icon.`);
      updateIconState(tabId, false);
    }
  });

  /**
   * Listens for tab removal to clean up the state map.
   */
  browser.tabs.onRemoved.addListener((tabId) => {
    mainLogger.info(`Tab ${tabId} removed, cleaning up state.`);
    if (activeTabsMap.has(tabId)) {
      activeTabsMap.delete(tabId);
    }
  });

  /**
   * Listens for extension suspension to clean up resources.
   */
  browser.runtime.onSuspend.addListener(() => {
    mainLogger.info(`Extension is suspending, cleaning up resources.`);
    activeTabsMap.clear();
  });

  /**
   * Handles clicks on the browser action (extension icon).
   * Firefox MV2 uses browserAction, Chrome MV3 uses action.
   * We try both for maximum compatibility.
   */
  const actionApi = browser.action || (browser as any).browserAction;
  if (actionApi?.onClicked) {
    actionApi.onClicked.addListener(async (tab: any) => {
      mainLogger.info(`Action icon clicked for tab: ${tab.id}, url: ${tab.url}`);
      await handleToggleReaderMode(tab);
    });
    mainLogger.info(`Registered action click listener using: ${browser.action ? 'browser.action' : 'browser.browserAction'}`);
  } else {
    mainLogger.error(`Neither browser.action nor browser.browserAction available!`);
  }

  // Log when background script is loaded
  mainLogger.info(`Background script loaded, browser.action: ${!!browser.action}, browser.browserAction: ${!!(browser as any).browserAction}`);
});

// --- Content Script & Tab State Handling ---

/**
 * Handles the CONTENT_SCRIPT_READY message.
 */
function handleContentScriptReady(
  sender: any, // browser.runtime.MessageSender
  sendResponse: (response?: any) => void,
) {
  mainLogger.info(`Content script ready in tab: ${sender.tab?.id}`);
  sendResponse({ received: true });
}

/**
 * Handles the READER_MODE_CHANGED message from the content script.
 * Updates the internal state map and the browser action icon.
 */
function handleReaderModeChanged(
  isActive: boolean,
  tabId: number,
  sendResponse: (response?: any) => void,
) {
  mainLogger.info(`Reader mode changed in tab ${tabId}: ${isActive}`);
  activeTabsMap.set(tabId, isActive);
  updateIconState(tabId, isActive);
  sendResponse({ received: true });
}

/**
 * Updates the browser action icon (badge) for a specific tab based on reader mode state.
 */
function updateIconState(tabId: number, isActive: boolean) {
  try {
    const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
    const text = isActive ? "ON" : "";

    // Use action API with fallback to browserAction for Firefox MV2
    const actionApi = browser.action || (browser as any).browserAction;
    if (!actionApi) {
      mainLogger.warn(`No action API available for updating icon state`);
      return;
    }
    
    actionApi.setBadgeBackgroundColor({ tabId: tabId, color: color as any });
    // setBadgeTextColor is not supported in all Firefox versions, wrap in try/catch or check
    if (actionApi.setBadgeTextColor) {
        actionApi.setBadgeTextColor({ tabId: tabId, color: BADGE_TEXT_COLOR as any });
    }
    actionApi.setBadgeText({ tabId: tabId, text: text });
  } catch (error) {
    mainLogger.error(
      `Failed to update icon for tab ${tabId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Sends a command to the content script to toggle the reader mode view.
 * Uses message passing instead of script injection for better Firefox compatibility.
 */
async function handleToggleReaderMode(tab?: any) { // browser.tabs.Tab
  if (!tab?.id) {
    mainLogger.warn(`Attempted to toggle reader mode without valid tab.`);
    return;
  }

  // Skip restricted schemes where content scripts cannot be injected
  const url: string = tab.url || "";
  if (url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chrome-extension://") || url.startsWith("view-source:")) {
    mainLogger.warn(`Cannot inject reader into restricted page: ${url}`);
    return;
  }

  mainLogger.info(`Requesting toggle in tab ${tab.id}`);
  try {
    // Use message passing instead of browser.scripting.executeScript
    // This is more reliable across Chrome and Firefox (both MV2 and MV3)
    await browser.tabs.sendMessage(tab.id, { type: "TOGGLE_READER" });
    mainLogger.info(`Toggle message sent to tab ${tab.id}.`);
  } catch (error) {
    mainLogger.error(
      `Failed to send toggle message to tab ${tab.id}: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Fallback: content script might not be injected yet (Edge/Chrome MV3 race).
    try {
      mainLogger.info(`Attempting to inject content script into tab ${tab.id} then retry toggle.`);
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content-scripts/content.js"],
      });
      await browser.tabs.sendMessage(tab.id, { type: "TOGGLE_READER" });
      mainLogger.info(`Toggle message sent after injection to tab ${tab.id}.`);
    } catch (injectErr) {
      mainLogger.error(
        `Content script injection/toggle failed for tab ${tab.id}: ${injectErr instanceof Error ? injectErr.message : String(injectErr)}`,
      );
    }
  }
}
