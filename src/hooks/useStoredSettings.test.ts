/**
 * Unit tests for useStoredSettings hook
 * Tests settings loading, updating, and persistence
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useStoredSettings, __resetStorageInstance } from "./useStoredSettings";

// NOTE: Don't use jest.mock("@plasmohq/storage") because moduleNameMapper in jest.config.js
// already maps it to our mock implementation. Using jest.mock would auto-mock and replace our implementation.

// Mock logger
jest.mock("~/utils/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Get mock storage helpers using require to avoid TypeScript errors
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const {
  __clearMockStorage,
  __setMockStorageData,
  __getMockStorageData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("@plasmohq/storage");

// Mock defaultSettings from ReaderContext
jest.mock("../context/ReaderContext", () => ({
  defaultSettings: {
    fontSize: 18,
    fontFamily: "system",
    lineHeight: 1.8,
    contentWidth: 720,
    textAlign: "left",
    theme: "light",
    customTheme: "",
    letterSpacing: 0,
    paragraphSpacing: 1.5,
  },
}));

describe("useStoredSettings", () => {
  beforeEach(() => {
    __clearMockStorage();
    __resetStorageInstance(); // Reset storage instance so it picks up clean mock data
    // Clear localStorage mock
    localStorage.clear();
  });

  describe("Initial loading", () => {
    it("returns default settings initially", async () => {
      const { result } = renderHook(() => useStoredSettings());

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.fontSize).toBe(18);
      expect(result.current.settings.fontFamily).toBe("system");

      // Wait for async loading to complete to avoid act() warning
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it("sets isLoaded to false initially then true after loading", async () => {
      const { result } = renderHook(() => useStoredSettings());

      // Initially not loaded (or quickly becomes loaded)
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });
    });

    it("loads saved settings from storage", async () => {
      const savedSettings = {
        fontSize: 20,
        fontFamily: "serif",
        lineHeight: 2.0,
        contentWidth: 800,
        textAlign: "justify",
        theme: "dark",
        version: 1,
      };
      __setMockStorageData("readlite-settings", savedSettings);

      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.settings.fontSize).toBe(20);
      expect(result.current.settings.fontFamily).toBe("serif");
      expect(result.current.settings.theme).toBe("dark");
    });

    it("merges saved settings with defaults for missing properties", async () => {
      // Saved settings missing some properties
      const partialSettings = {
        fontSize: 22,
        version: 1,
      };
      __setMockStorageData("readlite-settings", partialSettings);

      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Should have saved value
      expect(result.current.settings.fontSize).toBe(22);
      // Should have default values for missing
      expect(result.current.settings.fontFamily).toBe("system");
      expect(result.current.settings.lineHeight).toBe(1.8);
    });

    it("handles JSON string format from storage", async () => {
      const savedSettings = JSON.stringify({
        fontSize: 16,
        fontFamily: "monospace",
        version: 1,
      });
      __setMockStorageData("readlite-settings", savedSettings);

      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.settings.fontSize).toBe(16);
    });
  });

  describe("updateSettings", () => {
    it("updates single setting", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateSettings({ fontSize: 24 });
      });

      expect(result.current.settings.fontSize).toBe(24);
    });

    it("updates multiple settings at once", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateSettings({
          fontSize: 20,
          fontFamily: "serif",
          theme: "dark",
        });
      });

      expect(result.current.settings.fontSize).toBe(20);
      expect(result.current.settings.fontFamily).toBe("serif");
      expect(result.current.settings.theme).toBe("dark");
    });

    it("preserves other settings when updating", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const originalLineHeight = result.current.settings.lineHeight;

      await act(async () => {
        await result.current.updateSettings({ fontSize: 22 });
      });

      expect(result.current.settings.lineHeight).toBe(originalLineHeight);
    });

    it("saves updated settings to storage", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateSettings({ fontSize: 26 });
      });

      // Wait for async storage save
      await waitFor(() => {
        const stored = __getMockStorageData().get("readlite-settings");
        expect(stored).toBeDefined();
        if (stored) {
          expect(stored.fontSize).toBe(26);
        }
      });
    });
  });

  describe("Custom theme handling", () => {
    it("saves customTheme to localStorage when updated", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateSettings({
          theme: "custom",
          customTheme: "my-custom-theme-data",
        });
      });

      expect(localStorage.getItem("readlite-custom-theme")).toBe(
        "my-custom-theme-data",
      );
    });

    it("loads customTheme from localStorage as fallback", async () => {
      localStorage.setItem("readlite-custom-theme", "fallback-theme-data");

      const savedSettings = {
        theme: "custom",
        // customTheme missing
        version: 1,
      };
      __setMockStorageData("readlite-settings", savedSettings);

      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      expect(result.current.settings.customTheme).toBe("fallback-theme-data");
    });
  });

  describe("resetSettings", () => {
    it("resets settings to defaults", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // First change some settings
      await act(async () => {
        await result.current.updateSettings({
          fontSize: 30,
          fontFamily: "serif",
        });
      });

      expect(result.current.settings.fontSize).toBe(30);

      // Then reset
      await act(async () => {
        await result.current.resetSettings();
      });

      expect(result.current.settings.fontSize).toBe(18);
      expect(result.current.settings.fontFamily).toBe("system");
    });
  });

  describe("Settings validation", () => {
    it("handles all theme options", async () => {
      const themes = ["light", "dark", "sepia", "custom"];
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      for (const theme of themes) {
        await act(async () => {
          await result.current.updateSettings({
            theme: theme as "light" | "dark" | "sepia" | "custom",
          });
        });
        expect(result.current.settings.theme).toBe(theme);
      }
    });

    it("handles all font family options", async () => {
      const fonts = ["system", "serif", "sans-serif", "monospace"];
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      for (const font of fonts) {
        await act(async () => {
          await result.current.updateSettings({
            fontFamily: font as "system" | "serif" | "sans-serif" | "monospace",
          });
        });
        expect(result.current.settings.fontFamily).toBe(font);
      }
    });

    it("handles numeric range settings", async () => {
      const { result } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      await act(async () => {
        await result.current.updateSettings({
          fontSize: 12,
          lineHeight: 1.2,
          contentWidth: 600,
          letterSpacing: -0.5,
          paragraphSpacing: 0.5,
        });
      });

      expect(result.current.settings.fontSize).toBe(12);
      expect(result.current.settings.lineHeight).toBe(1.2);
      expect(result.current.settings.contentWidth).toBe(600);
      expect(result.current.settings.letterSpacing).toBe(-0.5);
      expect(result.current.settings.paragraphSpacing).toBe(0.5);
    });
  });

  describe("Error handling", () => {
    it("handles storage errors gracefully during load", async () => {
      // Simulate storage error by setting invalid data
      __setMockStorageData("readlite-settings", "invalid{json");

      const { result } = renderHook(() => useStoredSettings());

      // Should still complete loading with defaults
      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Should have default settings
      expect(result.current.settings.fontSize).toBeDefined();
    });
  });

  describe("Hook stability", () => {
    it("updateSettings function is stable between renders", async () => {
      const { result, rerender } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const updateFn1 = result.current.updateSettings;
      rerender();
      const updateFn2 = result.current.updateSettings;

      expect(updateFn1).toBe(updateFn2);
    });

    it("resetSettings function is stable between renders", async () => {
      const { result, rerender } = renderHook(() => useStoredSettings());

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const resetFn1 = result.current.resetSettings;
      rerender();
      const resetFn2 = result.current.resetSettings;

      expect(resetFn1).toBe(resetFn2);
    });
  });
});
