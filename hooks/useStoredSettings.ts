import { storage } from "wxt/storage";
import { useCallback, useEffect, useState } from "react";
import { defaultSettings } from "@/context/ReaderContext";
import { createLogger } from "@/utils/logger";
import { saveTheme } from "@/utils/themeManager";
import {
  ThemeType,
  AVAILABLE_THEMES,
  normalizeTheme,
  LEGACY_THEME_MAP,
} from "@/config/theme";

// Create a logger for this module
const logger = createLogger("settings");

// Storage key name with application prefix
const SETTINGS_KEY = "local:readlite-settings";
const SETTINGS_VERSION = 1;

/**
 * Settings hook
 * Manages and persists all reader settings
 */
export const useStoredSettings = () => {
  // Use default settings as initial state
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load stored settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Try to get settings from WXT storage
        const storedSettings = await storage.getItem(SETTINGS_KEY);

        if (storedSettings) {
          // Merge settings, ensure new properties exist
          const mergedSettings = {
            ...defaultSettings,
            ...(storedSettings as object),
            // Update version number
            version: SETTINGS_VERSION,
          };

          // Guard + migrate: normalize legacy theme names
          mergedSettings.theme = normalizeTheme(mergedSettings.theme);

          setSettings(mergedSettings);
          try {
            // Sync localStorage theme key so shadow-root listener can react
            saveTheme(mergedSettings.theme as ThemeType);
          } catch (e) {
            logger.warn("Unable to sync theme to localStorage on load", e);
          }
        } else {
          // Initialize default settings
          await storage.setItem(SETTINGS_KEY, {
            ...defaultSettings,
            version: SETTINGS_VERSION,
          });
          try {
            saveTheme(defaultSettings.theme as ThemeType);
          } catch (e) {
            logger.warn("Unable to sync default theme to localStorage", e);
          }
        }
      } catch (error) {
        logger.error("Error loading settings from storage:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSettings();
  }, []);

  // Update settings and save to storage
  const updateSettings = useCallback(
    async (newSettings: Partial<typeof defaultSettings>) => {
      try {
        const settingsToUpdate = { ...newSettings };

        // Special handling for customTheme to ensure it's saved to localStorage too
        // If theme changes, sync to localStorage (drives shadow DOM listener)
        if (typeof settingsToUpdate.theme !== "undefined") {
          try {
            // Normalize legacy theme names and fallback if unknown
            const nextTheme = normalizeTheme(settingsToUpdate.theme as string);
            saveTheme(nextTheme);
            settingsToUpdate.theme = nextTheme;
          } catch (e) {
            logger.error("Failed to save theme to localStorage", e);
          }
        }

        // Update state
        setSettings((current: typeof defaultSettings) => {
          const updated = { ...current, ...settingsToUpdate };

          // Save to storage using WXT API
          storage
            .setItem(SETTINGS_KEY, updated)
            .then(() => {
              // Verify storage
              return storage.getItem(SETTINGS_KEY);
            })
            .then(() => {})
            .catch((err) => {
              logger.error("Failed to save settings to storage:", err);
            });

          return updated;
        });
      } catch (error) {
        logger.error("Failed to update settings:", error);
      }
    },
    [],
  );

  // Reset settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      const resetValues = {
        ...defaultSettings,
        version: SETTINGS_VERSION,
      };

      await storage.setItem(SETTINGS_KEY, resetValues);
      setSettings(resetValues);
    } catch (error) {
      logger.error("Failed to reset settings:", error);
    }
  }, []);

  return {
    settings,
    updateSettings,
    isLoaded,
    resetSettings,
  };
};
