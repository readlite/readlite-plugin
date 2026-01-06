/**
 * Jest setup file
 * Configures testing environment with necessary mocks and extensions
 */

// Add jest-dom matchers
require("@testing-library/jest-dom");

// Mock window.matchMedia for theme tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: jest.fn((key) => localStorageMock.store[key] || null),
  setItem: jest.fn((key, value) => {
    localStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key) => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock Chrome APIs globally
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onSuspend: {
      addListener: jest.fn(),
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
    id: "mock-extension-id",
  },
  action: {
    setBadgeBackgroundColor: jest.fn(),
    setBadgeTextColor: jest.fn(),
    setBadgeText: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    onUpdated: {
      addListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
    },
    query: jest.fn(() => Promise.resolve([])),
    get: jest.fn((tabId) => Promise.resolve({ id: tabId, url: "https://example.com" })),
    sendMessage: jest.fn(() => Promise.resolve()),
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([{ result: undefined }])),
  },
  downloads: {
    download: jest.fn((options, callback) => {
      if (callback) callback(1);
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
};

global.chrome = mockChrome;

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

// Suppress console errors during tests (optional, comment out for debugging)
// global.console.error = jest.fn();
// global.console.warn = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});
