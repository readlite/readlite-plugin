/**
 * Mock for @plasmohq/storage
 * Simulates browser extension storage API for testing
 */

// In-memory storage for tests
const mockStorageData = new Map();

// Track storage instances for test inspection
const storageInstances = [];

class MockStorage {
  constructor(options = {}) {
    this.area = options.area || "local";
    this._data = mockStorageData;
    storageInstances.push(this);
  }

  get(key) {
    return Promise.resolve(this._data.get(key) ?? null);
  }

  set(key, value) {
    this._data.set(key, value);
    return Promise.resolve(undefined);
  }

  remove(key) {
    this._data.delete(key);
    return Promise.resolve(undefined);
  }

  getAll() {
    const result = {};
    for (const [key, value] of this._data.entries()) {
      result[key] = value;
    }
    return Promise.resolve(result);
  }

  clear() {
    this._data.clear();
    return Promise.resolve(undefined);
  }

  // Watch functionality (simplified mock)
  watch(callbacks) {
    // Return unsubscribe function
    return () => {};
  }
}

// Helper functions for tests
const clearMockStorage = () => {
  mockStorageData.clear();
};

const getMockStorageData = () => {
  // Return the actual storage data Map, not a copy
  // This allows tests to verify stored data
  return mockStorageData;
};

const setMockStorageData = (key, value) => {
  mockStorageData.set(key, value);
};

module.exports = {
  Storage: MockStorage,
  // Test helpers
  __clearMockStorage: clearMockStorage,
  __getMockStorageData: getMockStorageData,
  __setMockStorageData: setMockStorageData,
  __storageInstances: storageInstances,
};
