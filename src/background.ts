/**
 * Background script for the ReadLite extension
 * Handles icon clicks and executes content script function
 */

import { createLogger } from './utils/logger';

const mainLogger = createLogger('background');
const messageLogger = createLogger('background-messages');

// --- Constants ---

// Track which tabs have reader mode active
const activeTabsMap = new Map<number, boolean>();

// Colors for the extension icon (Used by updateIconState)
const ACTIVE_COLOR: [number, number, number, number] = [187, 156, 216, 255]; // #BB9CD8
const INACTIVE_COLOR: [number, number, number, number] = [216, 216, 240, 255]; // #D8D8F0
const BADGE_TEXT_COLOR: [number, number, number, number] = [255, 255, 255, 255]; // White

// --- Types --- 

interface ToggleReaderModeMessage { type: 'TOGGLE_READER_MODE'; }
interface ContentScriptReadyMessage { type: 'CONTENT_SCRIPT_READY'; }
interface ReaderModeChangedMessage { type: 'READER_MODE_CHANGED'; isActive: boolean; }

type BackgroundMessage = 
  ToggleReaderModeMessage | 
  ContentScriptReadyMessage | 
  ReaderModeChangedMessage;

// --- Main Message Listener --- 

/**
 * Handles incoming messages from content scripts.
 */
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (!tabId) {
    messageLogger.warn(`Received message type "${message.type}" without sender tab ID. Ignoring.`);
    return false;
  }
   
  switch (message.type) {
    case 'CONTENT_SCRIPT_READY':
      handleContentScriptReady(sender, sendResponse);
      return true;
    case 'READER_MODE_CHANGED':
      handleReaderModeChanged(message.isActive, tabId, sendResponse);
      return true;
    case 'TOGGLE_READER_MODE':
      handleToggleReaderMode(sender.tab);
      break;
    default:
      return false;
  }

  return false; 
});

// --- Content Script & Tab State Handling ---

/**
 * Handles the CONTENT_SCRIPT_READY message.
 */
function handleContentScriptReady(sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  mainLogger.info(`Content script ready in tab: ${sender.tab?.id}`);
  sendResponse({ received: true });
}

/**
 * Handles the READER_MODE_CHANGED message from the content script.
 * Updates the internal state map and the browser action icon.
 */
function handleReaderModeChanged(isActive: boolean, tabId: number, sendResponse: (response?: any) => void) {
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

    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
    chrome.action.setBadgeTextColor({ tabId: tabId, color: BADGE_TEXT_COLOR });
    chrome.action.setBadgeText({ tabId: tabId, text: text });
  } catch (error) {
    mainLogger.error(`Failed to update icon for tab ${tabId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sends a command to the content script to toggle the reader mode view.
 */
async function handleToggleReaderMode(tab?: chrome.tabs.Tab) {
  if (!tab?.id) {
    mainLogger.warn(`Attempted to toggle reader mode without valid tab.`);
    return;
  }
  
  mainLogger.info(`Requesting toggle in tab ${tab.id}`);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.dispatchEvent(new CustomEvent('READLITE_TOGGLE_INTERNAL'));
      }
    });
    mainLogger.info(`Toggle script executed for tab ${tab.id}.`);
  } catch (error) {
    mainLogger.error(`Failed to execute toggle script for tab ${tab.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Browser Event Listeners ---

/**
 * Listens for tab updates (e.g., page loads) to reset the icon state.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    mainLogger.info(`Tab ${tabId} updated (status: complete), resetting icon.`);
    updateIconState(tabId, false);
  }
});

/**
 * Listens for tab removal to clean up the state map.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  mainLogger.info(`Tab ${tabId} removed, cleaning up state.`);
  if (activeTabsMap.has(tabId)) {
      activeTabsMap.delete(tabId);
  }
});

/**
 * Listens for extension suspension to clean up resources.
 */
chrome.runtime.onSuspend.addListener(() => {
  mainLogger.info(`Extension is suspending, cleaning up resources.`);
  activeTabsMap.clear();
});

/**
 * Handles clicks on the browser action (extension icon).
 */
chrome.action.onClicked.addListener(async (tab) => {
  mainLogger.info(`Action icon clicked for tab: ${tab.id}`);
  await handleToggleReaderMode(tab);
});