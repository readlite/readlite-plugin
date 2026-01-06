/**
 * Mock for Chrome Extension APIs
 * Provides comprehensive mocking for testing background and content scripts
 */

// Track calls for test assertions
export const mockCalls = {
  sendMessage: [] as unknown[],
  executeScript: [] as unknown[],
  setBadgeText: [] as unknown[],
  setBadgeBackgroundColor: [] as unknown[],
  setBadgeTextColor: [] as unknown[],
  download: [] as unknown[],
};

// Track registered listeners
export const mockListeners = {
  onMessage: [] as Function[],
  onClicked: [] as Function[],
  onUpdated: [] as Function[],
  onRemoved: [] as Function[],
  onSuspend: [] as Function[],
};

// Message response handlers for testing
let messageResponseHandler: ((response: unknown) => void) | null = null;

const createMockChrome = () => ({
  runtime: {
    onMessage: {
      addListener: jest.fn((callback: Function) => {
        mockListeners.onMessage.push(callback);
      }),
      removeListener: jest.fn((callback: Function) => {
        const index = mockListeners.onMessage.indexOf(callback);
        if (index > -1) mockListeners.onMessage.splice(index, 1);
      }),
      hasListener: jest.fn((callback: Function) => {
        return mockListeners.onMessage.includes(callback);
      }),
    },
    sendMessage: jest.fn((message: unknown, callback?: (response: unknown) => void) => {
      mockCalls.sendMessage.push(message);
      if (callback) {
        messageResponseHandler = callback;
      }
      return Promise.resolve();
    }),
    onSuspend: {
      addListener: jest.fn((callback: Function) => {
        mockListeners.onSuspend.push(callback);
      }),
    },
    getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
    id: "mock-extension-id",
  },

  action: {
    setBadgeBackgroundColor: jest.fn((details) => {
      mockCalls.setBadgeBackgroundColor.push(details);
      return Promise.resolve();
    }),
    setBadgeTextColor: jest.fn((details) => {
      mockCalls.setBadgeTextColor.push(details);
      return Promise.resolve();
    }),
    setBadgeText: jest.fn((details) => {
      mockCalls.setBadgeText.push(details);
      return Promise.resolve();
    }),
    onClicked: {
      addListener: jest.fn((callback: Function) => {
        mockListeners.onClicked.push(callback);
      }),
    },
  },

  tabs: {
    onUpdated: {
      addListener: jest.fn((callback: Function) => {
        mockListeners.onUpdated.push(callback);
      }),
    },
    onRemoved: {
      addListener: jest.fn((callback: Function) => {
        mockListeners.onRemoved.push(callback);
      }),
    },
    query: jest.fn(() => Promise.resolve([])),
    get: jest.fn((tabId: number) => Promise.resolve({ id: tabId, url: "https://example.com" })),
    sendMessage: jest.fn((tabId: number, message: unknown) => {
      mockCalls.sendMessage.push({ tabId, message });
      return Promise.resolve();
    }),
  },

  scripting: {
    executeScript: jest.fn((details) => {
      mockCalls.executeScript.push(details);
      return Promise.resolve([{ result: undefined }]);
    }),
  },

  downloads: {
    download: jest.fn((options, callback) => {
      mockCalls.download.push(options);
      if (callback) callback(1); // Return mock download ID
      return Promise.resolve(1);
    }),
  },

  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
    },
    sync: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
});

// Helper functions for tests
export const resetMockChrome = () => {
  // Reset call records
  mockCalls.sendMessage = [];
  mockCalls.executeScript = [];
  mockCalls.setBadgeText = [];
  mockCalls.setBadgeBackgroundColor = [];
  mockCalls.setBadgeTextColor = [];
  mockCalls.download = [];
  
  // NOTE: Don't reset mockListeners here because listeners are registered
  // when modules are loaded. Clearing them would break tests since modules
  // are only loaded once. Use resetMockListeners() if you need to clear them.
  
  messageResponseHandler = null;
};

// Separate function to reset listeners (use with caution)
export const resetMockListeners = () => {
  mockListeners.onMessage = [];
  mockListeners.onClicked = [];
  mockListeners.onUpdated = [];
  mockListeners.onRemoved = [];
  mockListeners.onSuspend = [];
};

// Simulate sending a message to the background script
export const simulateMessage = (
  message: unknown,
  sender: chrome.runtime.MessageSender = { tab: { id: 1 } as chrome.tabs.Tab }
) => {
  const responses: unknown[] = [];
  const sendResponse = (response: unknown) => {
    responses.push(response);
  };

  mockListeners.onMessage.forEach((listener) => {
    listener(message, sender, sendResponse);
  });

  return responses;
};

// Simulate tab events
export const simulateTabUpdated = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => {
  mockListeners.onUpdated.forEach((listener) => {
    listener(tabId, changeInfo, tab);
  });
};

export const simulateTabRemoved = (tabId: number) => {
  mockListeners.onRemoved.forEach((listener) => {
    listener(tabId, {});
  });
};

export const simulateActionClicked = (tab: chrome.tabs.Tab) => {
  mockListeners.onClicked.forEach((listener) => {
    listener(tab);
  });
};

// Create and export the mock
const mockChrome = createMockChrome();

export default mockChrome;

// Setup for global injection
export const setupChromeMock = () => {
  (global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;
};
