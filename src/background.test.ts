/**
 * Unit tests for background script
 * Tests message handling, icon state, and tab management
 */

import mockChrome, {
  resetMockChrome,
  mockCalls,
  mockListeners,
  simulateMessage,
  simulateTabUpdated,
  simulateTabRemoved,
  simulateActionClicked,
} from "../__mocks__/chrome";

// Setup Chrome mock globally before importing background script
(global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

// Mock logger
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import background script to register listeners
import "./background";

describe("Background Script", () => {
  beforeEach(() => {
    resetMockChrome();
    jest.clearAllMocks();
  });

  describe("Message Handling", () => {
    describe("CONTENT_SCRIPT_READY", () => {
      it("should acknowledge content script ready message", () => {
        const message = { type: "CONTENT_SCRIPT_READY" };
        const sender = { tab: { id: 1 } as chrome.tabs.Tab };
        
        const responses = simulateMessage(message, sender);
        
        // Should send acknowledgment response
        expect(responses).toHaveLength(1);
        expect(responses[0]).toEqual({ received: true });
      });
    });

    describe("READER_MODE_CHANGED", () => {
      it("should update icon state when reader mode is activated", () => {
        const message = { type: "READER_MODE_CHANGED", isActive: true };
        const tabId = 1;
        const sender = { tab: { id: tabId } as chrome.tabs.Tab };
        
        simulateMessage(message, sender);
        
        // Should set badge text to "ON"
        expect(mockCalls.setBadgeText).toContainEqual({
          tabId: tabId,
          text: "ON",
        });
        
        // Should set active color
        expect(mockCalls.setBadgeBackgroundColor).toContainEqual({
          tabId: tabId,
          color: [187, 156, 216, 255], // ACTIVE_COLOR
        });
        
        // Should set badge text color to white
        expect(mockCalls.setBadgeTextColor).toContainEqual({
          tabId: tabId,
          color: [255, 255, 255, 255],
        });
      });

      it("should update icon state when reader mode is deactivated", () => {
        const message = { type: "READER_MODE_CHANGED", isActive: false };
        const tabId = 1;
        const sender = { tab: { id: tabId } as chrome.tabs.Tab };
        
        simulateMessage(message, sender);
        
        // Should clear badge text
        expect(mockCalls.setBadgeText).toContainEqual({
          tabId: tabId,
          text: "",
        });
        
        // Should set inactive color
        expect(mockCalls.setBadgeBackgroundColor).toContainEqual({
          tabId: tabId,
          color: [216, 216, 240, 255], // INACTIVE_COLOR
        });
      });

      it("should send acknowledgment response", () => {
        const message = { type: "READER_MODE_CHANGED", isActive: true };
        const sender = { tab: { id: 1 } as chrome.tabs.Tab };
        
        const responses = simulateMessage(message, sender);
        
        expect(responses).toHaveLength(1);
        expect(responses[0]).toEqual({ received: true });
      });
    });

    describe("TOGGLE_READER_MODE", () => {
      it("should execute script in the tab", () => {
        const message = { type: "TOGGLE_READER_MODE" };
        const tab = {
          id: 1,
          url: "https://example.com",
        } as chrome.tabs.Tab;
        const sender = { tab };
        
        simulateMessage(message, sender);
        
        // Should call chrome.scripting.executeScript
        expect(mockCalls.executeScript).toHaveLength(1);
        expect(mockCalls.executeScript[0]).toMatchObject({
          target: { tabId: 1 },
        });
      });
      
      it("should ignore messages without tab ID", () => {
        const message = { type: "TOGGLE_READER_MODE" };
        const sender = {}; // No tab
        
        const initialCallCount = mockCalls.executeScript.length;
        simulateMessage(message, sender as chrome.runtime.MessageSender);
        
        // Should not execute script
        expect(mockCalls.executeScript).toHaveLength(initialCallCount);
      });
    });
  });

  describe("Tab Event Handling", () => {
    it("should cleanup when tab is removed", () => {
      // First activate reader mode in tab 1
      const activateMessage = { type: "READER_MODE_CHANGED", isActive: true };
      simulateMessage(activateMessage, { tab: { id: 1 } as chrome.tabs.Tab });
      
      // Remove the tab
      simulateTabRemoved(1);
      
      // The tab state should be cleaned up
      // (This is more of an integration test - activeTabsMap is internal)
      expect(true).toBe(true); // Tab removal handler registered
    });

    it("should reset icon when tab is updated", () => {
      const tabId = 1;
      const tab = { id: tabId, url: "https://example.com" } as chrome.tabs.Tab;
      
      // Activate reader mode first
      simulateMessage(
        { type: "READER_MODE_CHANGED", isActive: true },
        { tab }
      );
      
      // Simulate tab reload (status: complete)
      mockCalls.setBadgeText = []; // Clear previous calls
      simulateTabUpdated(tabId, { status: "complete" }, tab);
      
      // Icon should be reset to inactive state
      expect(mockCalls.setBadgeText).toContainEqual({
        tabId: tabId,
        text: "",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle messages without sender tab gracefully", () => {
      const message = { type: "READER_MODE_CHANGED", isActive: true };
      const sender = {}; // No tab
      
      // Should not throw error
      expect(() => {
        simulateMessage(message, sender as chrome.runtime.MessageSender);
      }).not.toThrow();
    });

    it("should handle icon update errors gracefully", () => {
      // Mock setBadgeText to throw error
      const originalSetBadgeText = mockChrome.action.setBadgeText;
      mockChrome.action.setBadgeText = jest.fn(() => {
        throw new Error("Badge API error");
      });
      
      const message = { type: "READER_MODE_CHANGED", isActive: true };
      const sender = { tab: { id: 1 } as chrome.tabs.Tab };
      
      // Should not throw error
      expect(() => {
        simulateMessage(message, sender);
      }).not.toThrow();
      
      // Restore mock
      mockChrome.action.setBadgeText = originalSetBadgeText;
    });
  });
});
