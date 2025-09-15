import { Storage } from "@plasmohq/storage";
import { useCallback, useEffect, useState } from "react";
import { defaultSettings } from "../context/ReaderContext";
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger("settings");

// Create storage instance
const storage = new Storage({
  area: "local", // Use extension's local storage area
});

// Storage key name with application prefix
const SETTINGS_KEY = "readlite-settings";
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
        // Try to get settings from Plasmo storage
        const storedSettings = await storage.get(SETTINGS_KEY);

        if (storedSettings) {
          // Parse stored settings if needed
          const parsedSettings =
            typeof storedSettings === "string"
              ? JSON.parse(storedSettings)
              : storedSettings;

          // Merge settings, ensure new properties exist
          const mergedSettings = {
            ...defaultSettings,
            ...parsedSettings,
            // Update version number
            version: SETTINGS_VERSION,
          };

          // If using custom theme, check if we have saved custom theme settings
          if (
            mergedSettings.theme === "custom" &&
            !mergedSettings.customTheme
          ) {
            try {
              // Try to load from localStorage as a fallback
              const savedCustomTheme = localStorage.getItem(
                "readlite-custom-theme",
              );
              if (savedCustomTheme) {
                logger.info(
                  "Found saved custom theme in localStorage, applying to settings",
                );
                mergedSettings.customTheme = savedCustomTheme;
              }
            } catch (e) {
              logger.error("Failed to load custom theme from localStorage:", e);
            }
          }

          setSettings(mergedSettings);
        } else {
          // Initialize default settings
          await storage.set(SETTINGS_KEY, {
            ...defaultSettings,
            version: SETTINGS_VERSION,
          });
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
        if ("customTheme" in settingsToUpdate) {
          try {
            localStorage.setItem(
              "readlite-custom-theme",
              settingsToUpdate.customTheme as string,
            );
            logger.info(
              "Saved customTheme to localStorage from updateSettings",
            );
          } catch (e) {
            logger.error("Failed to save customTheme to localStorage", e);
          }
        }

        // Update state
        setSettings((current: typeof defaultSettings) => {
          const updated = { ...current, ...settingsToUpdate };

          // Save to storage using Plasmo API
          storage
            .set(SETTINGS_KEY, updated)
            .then(() => {
              // Verify storage
              return storage.get(SETTINGS_KEY);
            })
            .then((_saved) => {
              // Verify customTheme was saved if present
              if ("customTheme" in updated && updated.theme === "custom") {
                // Double-check customTheme is in localStorage too
                try {
                  const localCustomTheme = localStorage.getItem(
                    "readlite-custom-theme",
                  );
                  if (!localCustomTheme) {
                    localStorage.setItem(
                      "readlite-custom-theme",
                      updated.customTheme as string,
                    );
                    logger.info(
                      "Re-saved customTheme to localStorage after verifying",
                    );
                  }
                } catch (e) {
                  logger.error(
                    "Error checking localStorage for customTheme",
                    e,
                  );
                }
              }
            })
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

      await storage.set(SETTINGS_KEY, resetValues);
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
