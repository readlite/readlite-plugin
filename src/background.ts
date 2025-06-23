/**
 * Background script for the ReadLite extension
 * Handles icon clicks and executes content script function
 */

// Background service worker for the ReadLite extension
import llmModule from './utils/llm';
import { getAuthToken, handleTokenExpiry } from './utils/auth';
import { Model } from './types/api';
import { createLogger } from './utils/logger';

// Create multiple loggers for specific areas of the background script
const mainLogger = createLogger('background');
const messageLogger = createLogger('background-messages');
const llmApiLogger = createLogger('background-llm-api');
const portLogger = createLogger('background-port');
const streamLogger = createLogger('background-stream');

// --- Constants ---

// Track which tabs have reader mode active
const activeTabsMap = new Map<number, boolean>();

// Colors for the extension icon (Used by updateIconState)
const ACTIVE_COLOR: [number, number, number, number] = [187, 156, 216, 255]; // #BB9CD8
const INACTIVE_COLOR: [number, number, number, number] = [216, 216, 240, 255]; // #D8D8F0
const BADGE_TEXT_COLOR: [number, number, number, number] = [255, 255, 255, 255]; // White

// --- State ---

// Store available models fetched from the server
let availableModels: Model[] = [];
// Track when models were last fetched (timestamp)
let lastModelsFetchTime = 0;
// Cache expiration time in milliseconds (1 hour)
const MODELS_CACHE_EXPIRY = 60 * 60 * 1000;

// --- Types --- 

// Define specific payload interfaces for messages
interface ToggleReaderModeMessage { type: 'TOGGLE_READER_MODE'; }
interface ContentScriptReadyMessage { type: 'CONTENT_SCRIPT_READY'; }
interface ReaderModeChangedMessage { type: 'READER_MODE_CHANGED'; isActive: boolean; }
interface LlmStreamRequestData {
  prompt: string;
  options: any;
  streamId: string;
}
interface LlmApiRequestData {
  method: string;
  params: any[]; // Keep params flexible for now, but method is required
}
interface LlmStreamRequestMessage { type: 'LLM_STREAM_REQUEST'; data: LlmStreamRequestData; }
interface LlmApiRequestMessage { type: 'LLM_API_REQUEST'; data: LlmApiRequestData; }
interface AuthStatusChangedMessage { 
  type: 'AUTH_STATUS_CHANGED'; 
  isAuthenticated: boolean; 
}
// Message to request the model list
interface GetModelsRequestMessage { 
  type: 'GET_MODELS_REQUEST'; 
  forceRefresh?: boolean;
}

// Union type defining all possible background message types
type BackgroundMessage = 
  ToggleReaderModeMessage | 
  ContentScriptReadyMessage | 
  ReaderModeChangedMessage | 
  LlmApiRequestMessage | 
  LlmStreamRequestMessage |
  AuthStatusChangedMessage |
  GetModelsRequestMessage;

// --- Main Message Listener --- 

/**
 * Handles incoming messages from content scripts and the side panel.
 */
chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  // Handle LLM API requests specifically
  if (message.type === 'LLM_API_REQUEST') {
    // Type guard ensures message.data exists here
    handleLlmApiRequest(message.data, sender, sendResponse);
    return true; // Indicates response will be sent asynchronously
  }

  // Other messages require a tab ID from the sender
  const tabId = sender.tab?.id;
  if (!tabId) {
    messageLogger.warn(`Received message type "${message.type}" without sender tab ID. Ignoring.`);
    return false; // No further processing, no async response
  }
   
  // Handle different message types from content scripts
  switch (message.type) {
    case 'CONTENT_SCRIPT_READY':
      handleContentScriptReady(sender, sendResponse);
      return true; // Async response possible
    case 'READER_MODE_CHANGED':
      // Type guard ensures message.isActive exists
      handleReaderModeChanged(message.isActive, tabId, sendResponse);
      return true; // Async response possible
    case 'TOGGLE_READER_MODE':
      handleToggleReaderMode(sender.tab);
      break; // Synchronous or no response needed
    case 'AUTH_STATUS_CHANGED':
      // Type guard ensures message.isAuthenticated exists
      handleAuthStatusChanged(message.isAuthenticated, sendResponse);
      return true; // Async response possible
    case 'GET_MODELS_REQUEST':
      handleGetModelsRequest(message as GetModelsRequestMessage, sendResponse);
      return true; // Async response possible
    default:
      // Optional: Handle unknown message types if necessary
      // messageLogger.warn(`Received unknown message type:`, message);
      return false;
  }

  // Return true if any path might use sendResponse asynchronously later,
  // otherwise return false or undefined for synchronous handling.
  // The switch cases handle returns, default is false.
  return false; 
});

// --- LLM API Handling ---

/**
 * Routes LLM API requests to the appropriate handler (streaming or regular).
 */
function handleLlmApiRequest(data: LlmApiRequestData, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
  llmApiLogger.info(`Received request for method: "${data.method}"`);
  
  // Use 'as any' for dynamic access, but add type checks
  const moduleToCheck = llmModule as any; 

  if (data.method === 'generateTextStream' && typeof moduleToCheck?.generateTextStream === 'function') {
    // Pass the actual function reference
    handleStreamingRequest(moduleToCheck.generateTextStream, data.params, sender, sendResponse);
  } else if (typeof moduleToCheck?.[data.method] === 'function') {
    // Pass the method name and the function reference
    handleRegularApiRequest(data.method, moduleToCheck[data.method], data.params, sendResponse);
  } else {
    llmApiLogger.error(`Method "${data.method}" not found or not a function in LLM module.`);
    sendResponse({ success: false, error: `Method ${data.method} not found in LLM API` });
  }
}

// Track active stream ports
const activeStreamPorts = new Map();

/**
 * Listen for port connections from the client
 * This handles LLM streaming more reliably than one-off messages
 */
chrome.runtime.onConnect.addListener((port) => {
  const portName = port.name || 'unknown';
  
  // Check if this is an LLM stream port
  if (portName.startsWith('llm_stream_')) {
    const streamId = portName.replace('llm_stream_', '');
    portLogger.info(`New stream connection established: ${streamId}`);
    
    // Store the port reference for potential cleanup later
    activeStreamPorts.set(streamId, port);
    
    // Handle disconnect
    port.onDisconnect.addListener(() => {
      portLogger.info(`Port disconnected: ${streamId}`);
      activeStreamPorts.delete(streamId);
      
      // Handle cleanup for a disconnected port
      // TODO: Consider canceling any ongoing stream process for this port
    });
    
    // Handle messages from the client
    port.onMessage.addListener((message) => {
      portLogger.info(`Received message on port ${streamId}: ${message.type}`);
      
      if (message.type === 'LLM_STREAM_REQUEST') {
        // Handle the streaming request via port
        handlePortStreamingRequest(message.data, port);
      }
    });
  }
});

/**
 * Handle streaming request using port communication
 */
function handlePortStreamingRequest(data: any, port: chrome.runtime.Port) {
  const { prompt, options, streamId } = data;
  streamLogger.info(`Handling stream request for ${streamId}`);
  
  try {
    const moduleToCheck = llmModule as any;
    if (typeof moduleToCheck?.generateTextStream !== 'function') {
      streamLogger.error(`generateTextStream method not found`);
      port.postMessage({ type: 'LLM_STREAM_ERROR', error: 'Stream method not available' });
      return;
    }
    
    streamLogger.info(`Setting up stream for prompt: "${prompt?.substring(0, 30)}..."`);
    
    // Set up safety timeout for entire streaming process
    let streamCompleted = false;
    const PORT_STREAM_TIMEOUT_MS = 120000; // 120 seconds
    
    const timeoutId = setTimeout(() => {
      if (!streamCompleted) {
        streamLogger.warn(`Port stream timeout triggered after ${PORT_STREAM_TIMEOUT_MS / 1000} seconds.`);
        // Send error message back through port
        try {
          if (port) {
            port.postMessage({ 
              type: 'LLM_STREAM_ERROR', 
              error: `Stream timed out after ${PORT_STREAM_TIMEOUT_MS / 1000} seconds`
            });
          }
        } catch (e) {
          streamLogger.error(`Error sending timeout message: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }, PORT_STREAM_TIMEOUT_MS);
    
    // Wrap the streamHandler to send chunks via port
    const streamHandler = (chunk: string) => {
      try {
        // Only send if port is still connected
        if (port) {
          port.postMessage({
            type: 'LLM_STREAM_CHUNK',
            data: { chunk },
            timestamp: Date.now()
          });
        }
      } catch (error) {
        streamLogger.error(`Error sending chunk via port: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    // Start the streaming process
    streamLogger.info(`Starting stream process`);
    moduleToCheck.generateTextStream(prompt, streamHandler, options)
      .then(() => {
        streamCompleted = true;
        clearTimeout(timeoutId); // Clear safety timeout
        streamLogger.info(`Stream completed successfully`);
        // Send completion message
        if (port) {
          port.postMessage({ type: 'LLM_STREAM_COMPLETE' });
        }
      })
      .catch((error: Error) => {
        streamCompleted = true;
        clearTimeout(timeoutId); // Clear safety timeout
        streamLogger.error(`Stream failed: ${error.message}`);
        // Send error message
        if (port) {
          port.postMessage({ 
            type: 'LLM_STREAM_ERROR', 
            error: error.message || 'Unknown streaming error'
          });
        }
      });
      
  } catch (error) {
    streamLogger.error(`Error in stream setup: ${error instanceof Error ? error.message : String(error)}`);
    port.postMessage({ 
      type: 'LLM_STREAM_ERROR', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Handles streaming LLM API requests.
 * Note: This method is kept for backward compatibility but new code should use port-based streaming
 */
function handleStreamingRequest(
  // Explicitly type the expected function signature
  streamMethod: (prompt: string, streamHandler: (chunk: string) => void, options?: any) => Promise<void>,
  params: any[], 
  sender: chrome.runtime.MessageSender, 
  // Nullable type to indicate if sendResponse has been used (e.g., by timeout)
  sendResponse: ((response?: any) => void) | null 
) {
  let localSendResponse = sendResponse; // Create a local copy to modify

  try {
    const [prompt, options] = params as [string, any];
    streamLogger.info(`Setting up stream handler for prompt starting with: "${prompt?.substring(0, 30)}..."`);
    
    const streamOptions = { ...options, stream: true };
    
    // Callback to send chunks back to the requesting context
    const streamHandler = (chunk: string) => {
      try {
        // Check if the extension context (chrome.runtime) is still valid before sending
        if (!chrome.runtime?.id) { 
          streamLogger.warn(`Extension context invalid, cannot send stream chunk.`);
          // TODO: Consider attempting to cancel the ongoing stream if context becomes invalid.
          return; 
        }
        
        // Send chunk back to the runtime (which could be sidepanel or other contexts)
        chrome.runtime.sendMessage({
          type: 'LLM_STREAM_CHUNK',
          data: { chunk },
          timestamp: Date.now() // Keep timestamp for potential ordering checks client-side
        }).catch(error => {
          // Catch errors during sending (e.g., if receiver closes)
          const errorMessage = chrome.runtime.lastError?.message || (error instanceof Error ? error.message : 'Unknown send error');
          streamLogger.warn(`Runtime error sending chunk: ${errorMessage}`);
          // TODO: Consider recommending port-based streaming when this error happens
          streamLogger.info(`Consider using port-based streaming for more reliable communication`);
        });
      } catch (error) {
        streamLogger.error(`Error inside stream handler: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    streamLogger.info(`Starting streaming process.`);
    let streamCompleted = false;
    
    // Safety timeout: If the stream promise doesn't resolve/reject within 120s,
    // send a failure response. This handles cases where the stream might hang indefinitely.
    const timeoutId = setTimeout(() => {
      if (!streamCompleted) {
        streamLogger.warn(`Stream safety timeout triggered after 120 seconds.`);
        if (localSendResponse) {
            localSendResponse({ success: false, error: 'Stream timed out after 120 seconds' });
            localSendResponse = null; // Mark response as sent
        } 
      }
    }, 120000);

    streamMethod(prompt, streamHandler, streamOptions)
      .then(() => {
        streamCompleted = true;
        clearTimeout(timeoutId); // Clear the safety timeout
        streamLogger.info(`Streaming completed successfully.`);
        if (localSendResponse) { // Check if timeout already responded
            localSendResponse({ success: true });
        } else {
            streamLogger.info(`Stream completed, but response already sent by timeout.`);
        }
      })
      .catch((error: Error) => {
        streamCompleted = true; 
        clearTimeout(timeoutId); // Clear the safety timeout
        streamLogger.error(`Streaming failed: ${error.message}`);
        streamLogger.error(`Error details: ${error instanceof Error ? error.message : String(error)}`);
        if (localSendResponse) { // Check if timeout already responded
            localSendResponse({ success: false, error: error.message });
        } else {
             streamLogger.info(`Stream failed, but response already sent by timeout.`);
        }
      });

  } catch (error) {
    streamLogger.error(`Error during stream setup: ${error instanceof Error ? error.message : String(error)}`);
    streamLogger.error(`Error details: ${error instanceof Error ? error.message : String(error)}`);
    if (localSendResponse) {
        localSendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * Handles regular (non-streaming) LLM API requests.
 */
function handleRegularApiRequest(
  method: string,
  // Explicitly type the expected function signature
  apiMethod: (...args: any[]) => Promise<any>,
  params: any[], 
  sendResponse: (response?: any) => void
) {
  llmApiLogger.info(`Calling method "${method}"`);
  try {
    apiMethod(...(params || []))
      .then((result: any) => {
        llmApiLogger.info(`Call to "${method}" successful.`);
        sendResponse({ success: true, data: result });
      })
      .catch(async (error: Error) => {
        llmApiLogger.error(`Call to "${method}" failed: ${error.message}`);
        llmApiLogger.error(`Error details: ${error.message}`); 
        
        // check if the error is an authentication error
        const isAuthError = error.message.includes('401') || 
                          error.message.toLowerCase().includes('unauthorized') ||
                          error.message.toLowerCase().includes('authentication failed');
        
        if (isAuthError) {
          llmApiLogger.warn(`Authentication error detected in "${method}", handling token expiry`);
          await handleTokenExpiry(error as any);
        }
        
        sendResponse({ success: false, error: error.message });
      });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    llmApiLogger.error(`Error executing method "${method}": ${errorMessage}`);
    llmApiLogger.error(`Error details: ${errorMessage}`);
    sendResponse({ success: false, error: errorMessage });
  }
}

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
    // mainLogger.info(`Updated icon for tab ${tabId}: ${text}`); // Optional: for debugging
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
        // This custom event is listened for by the content script (content.tsx)
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
  // When a tab finishes loading, reset its icon to default (inactive)
  // The content script will send READER_MODE_CHANGED if it activates reader mode.
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
  
  // Clean up any open LLM streams using 'as any' for safety
  const moduleForSuspend = llmModule as any; 
  if (typeof moduleForSuspend?.cancelAllStreams === 'function') {
    try {
      mainLogger.info(`Attempting to cancel LLM streams.`);
      moduleForSuspend.cancelAllStreams();
    } catch (e) {
      mainLogger.error(`Failed to cancel LLM streams:`, e);
    }
  } else {
      mainLogger.info(`cancelAllStreams method not found or not a function.`);
  }
  
  // Clear state map
  mainLogger.info(`Clearing active tabs map.`);
  activeTabsMap.clear();
});

/**
 * Handles clicks on the browser action (extension icon).
 */
chrome.action.onClicked.addListener(async (tab) => {
  mainLogger.info(`Action icon clicked for tab: ${tab.id}`);
  // Toggle reader mode when extension icon is clicked
  await handleToggleReaderMode(tab);
});

/**
 * Handles authentication status change message.
 * Broadcasts the new status to all tabs.
 */
function handleAuthStatusChanged(isAuthenticated: boolean, sendResponse: (response?: any) => void) {
  mainLogger.info(`Authentication status changed: ${isAuthenticated}`);
  
  // Broadcast to all tabs
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'AUTH_STATUS_CHANGED',
          isAuthenticated
        }).catch(error => {
          // Ignore errors, as some tabs may not have the content script running
          mainLogger.debug(`Failed to send auth status to tab ${tab.id}: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
    }
  });
  
  // Respond to confirm receipt
  sendResponse({ received: true });
}

/**
 * Fetches the list of available models from the API endpoint.
 * Updates the global `availableModels` state.
 */
async function fetchModelsInBackground(retryCount = 0, maxRetries = 3, retryDelay = 1500): Promise<void> {
  mainLogger.info(`Attempting to fetch models... (attempt ${retryCount + 1}/${maxRetries + 1})`);
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      mainLogger.warn(`No auth token available, this may result in limited model access`);
    }

    const response = await fetch('https://api.readlite.app/api/models', { headers });
    
    if (response.status === 401) {
      mainLogger.warn(`Received 401 Unauthorized, token expired`);
      // Handle token expiration and attempt to relogin
      await handleTokenExpiry(response as any);
      throw new Error(`Authentication failed: Your session has expired. Please log in again.`);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const responseData = await response.json();
    
    // Log the raw response to see its exact structure
    mainLogger.info(`API response structure:`, { 
      isArray: Array.isArray(responseData),
      type: typeof responseData
    });
    
    // Handle both formats: direct array or {models: [...]} object
    let models;
    if (Array.isArray(responseData)) {
      models = responseData;
    } else if (responseData && typeof responseData === 'object' && Array.isArray(responseData.models)) {
      models = responseData.models;
    } else {
      models = [];
    }
    
    mainLogger.info(`Extracted models (${models.length}):`, models);
    
    if (Array.isArray(models) && models.length > 0) {
      // Accept ALL models even if not ideally formatted - addresses immediate issue
      availableModels = models;
      mainLogger.info(`Successfully updated with ${models.length} models`);
    } else {
      mainLogger.warn(`No valid models found, using defaults.`);
      availableModels = []; // Reset to defaults if fetch is invalid
    }
  } catch (error) {
    // Convert error to string for logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    mainLogger.error(`Failed to fetch models: ${errorMessage}`);
    
    // check if the error is an authentication error
    const isAuthError = error instanceof Error && 
      (error.message.includes('Authentication failed') || 
       error.message.includes('401') || 
       error.message.toLowerCase().includes('unauthorized'));
    
    // if the error is not an authentication error and there are retries left, retry
    if (!isAuthError && retryCount < maxRetries) {
      mainLogger.info(`Will retry in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(fetchModelsInBackground(retryCount + 1, maxRetries, retryDelay));
        }, retryDelay);
      });
    }
    
    availableModels = []; // Reset to defaults on error after all retries
  }
}

/**
 * Handles the GET_MODELS_REQUEST message.
 */
function handleGetModelsRequest(message: GetModelsRequestMessage, sendResponse: (response?: any) => void) {
  mainLogger.info(`Received GET_MODELS_REQUEST`);
  
  const forceRefresh = message.forceRefresh === true;
  const isExpired = Date.now() - lastModelsFetchTime > MODELS_CACHE_EXPIRY;
  
  // Fetch new data if:
  // 1. Force refresh requested, OR
  // 2. Cache is empty/not loaded, OR
  // 3. Cache has expired
  if (forceRefresh || !availableModels || availableModels.length === 0 || isExpired) {
    const reason = forceRefresh ? "force refresh requested" : 
                  (!availableModels || availableModels.length === 0) ? "cache empty" : 
                  "cache expired";
    mainLogger.info(`Fetching from server (reason: ${reason})`);
    
    fetchModelsInBackground()
      .then(() => {
        lastModelsFetchTime = Date.now(); // Update the timestamp
        sendResponse({ success: true, data: availableModels, fromCache: false });
      })
      .catch((error) => {
        mainLogger.error(`Error fetching models:`, error);
        // If we have cached data, return it even on fetch error
        if (availableModels && availableModels.length > 0) {
          mainLogger.info(`Returning cached data despite fetch error`);
          sendResponse({ 
            success: true, 
            data: availableModels, 
            fromCache: true,
            fetchError: error instanceof Error ? error.message : String(error)
          });
        } else {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error), 
            data: [] 
          });
        }
      });
  } else {
    // Return cached models
    mainLogger.info(`Returning cached models (${availableModels.length} items)`);
    sendResponse({ success: true, data: availableModels, fromCache: true });
  }
}
