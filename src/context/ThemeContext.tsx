import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import {
  ThemeType,
  AgentColors,
  SettingsColors,
  ReaderColors,
  getAgentColors,
  getSettingsColors,
  getReaderColors,
  AVAILABLE_THEMES,
} from "../config/theme";
import {
  applyThemeGlobally,
  saveTheme,
  getPreferredTheme,
} from "../utils/themeManager";
import { createLogger } from "~/utils/logger";

const logger = createLogger("context");

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType, customTheme?: string) => void;
  customTheme?: string;
  getAgentColors: () => AgentColors;
  getUIColors: () => SettingsColors;
  getReaderColors: () => ReaderColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeType;
  currentTheme?: ThemeType;
}

// Local storage keys
  // Removed unused variable: THEME_STORAGE_KEY
const CUSTOM_THEME_STORAGE_KEY = "readlite-custom-theme";

/**
 * ThemeProvider is a component that provides the theme context to the application.
 * It manages the application's theme state and provides theme colors to child components.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme = "light",
  currentTheme,
}) => {
  // The theme state - if currentTheme is provided, use it, otherwise use the internal state
  const [internalTheme, setInternalTheme] = useState<ThemeType>(initialTheme);
  const [customTheme, setCustomTheme] = useState<string | undefined>(undefined);

  // Use the external theme or the internal state
  const theme = currentTheme || internalTheme;

  const setTheme = (newTheme: ThemeType, newCustomTheme?: string) => {
    // If the currentTheme prop is provided, the internal state change should not be applied
    // because the theme is controlled externally
    if (!currentTheme) {
      setInternalTheme(newTheme);

      if (newTheme === "custom") {
        if (newCustomTheme) {
          setCustomTheme(newCustomTheme);
        } else {
          try {
            const savedCustomTheme = localStorage.getItem(
              CUSTOM_THEME_STORAGE_KEY,
            );
            if (savedCustomTheme) {
              setCustomTheme(savedCustomTheme);

              applyThemeGlobally("custom", savedCustomTheme);
              logger.info(
                `[ThemeProvider] Loaded custom theme from storage: ${savedCustomTheme}`,
              );
            }
          } catch (e) {
            logger.error(
              "[ThemeProvider] Error loading custom theme from storage:",
              e,
            );
          }
        }
      }
    } else {
      logger.info(
        "[ThemeProvider] External theme control active - internal state change ignored",
      );
    }
  };

  // When the external theme changes, update the internal state (only for logging purposes)
  useEffect(() => {
    if (currentTheme) {
      logger.info(`[ThemeProvider] External theme update: ${currentTheme}`);
    }
  }, [currentTheme]);

  // Load the saved theme on initial render (only if currentTheme is not provided)
  useEffect(() => {
    if (!currentTheme) {
      try {
        // Use getPreferredTheme from themeManager
        const savedTheme = getPreferredTheme();
        // const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
        if (savedTheme && AVAILABLE_THEMES.includes(savedTheme as ThemeType)) {
          setInternalTheme(savedTheme as ThemeType);

          if (savedTheme === "custom") {
            const savedCustomTheme = localStorage.getItem(
              CUSTOM_THEME_STORAGE_KEY,
            );
            if (savedCustomTheme) {
              setCustomTheme(savedCustomTheme);

              applyThemeGlobally("custom", savedCustomTheme);
              logger.info(
                `[ThemeProvider] Loaded custom theme from storage: ${savedCustomTheme}`,
              );
            }
          }
        }
      } catch (e) {
        logger.error("[ThemeProvider] Error loading theme preference:", e);
      }
    }
  }, [currentTheme]);

  // Effect to apply the current theme - runs when theme or customTheme changes
  useEffect(() => {
    logger.info(
      `[ThemeProvider] Applying theme: ${theme}${customTheme ? " (custom)" : ""}`,
    );

    // For custom theme, ensure we have the latest value from localStorage if customTheme is not set
    if (theme === "custom" && !customTheme) {
      try {
        const savedCustomTheme = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
        if (savedCustomTheme) {
          logger.info(
            `[ThemeProvider] Loading custom theme from localStorage before applying: ${savedCustomTheme}`,
          );
          setCustomTheme(savedCustomTheme);
          // Apply the theme with the loaded customTheme
          applyThemeGlobally(theme, savedCustomTheme);
          return; // Skip the rest of the effect for now, it will run again when customTheme is set
        }
      } catch (e) {
        logger.error(
          "[ThemeProvider] Error loading custom theme from localStorage:",
          e,
        );
      }
    }

    // Apply the theme colors globally using the unified function
    applyThemeGlobally(theme, customTheme);

    // Save the theme preference to local storage
    try {
      // Use saveTheme from themeManager which also dispatches event
      saveTheme(theme);

      // Save custom theme if needed
      if (theme === "custom" && customTheme) {
        localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, customTheme);
        logger.info(
          `[ThemeProvider] Saved custom theme to localStorage: ${customTheme}`,
        );
      } else if (theme !== "custom") {
        // Clean up custom theme storage if a standard theme is selected
        localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
      }
    } catch (e) {
      logger.error("[ThemeProvider] Error saving theme preference:", e);
    }
  }, [theme, customTheme]);

  // Get the Agent UI colors - use useMemo to optimize performance
  const getAgentThemeColors = useMemo(() => {
    return () => getAgentColors(theme);
  }, [theme]);

  // Get the UI colors for the settings panel
  const getUIColors = useMemo(() => {
    return () => getSettingsColors(theme);
  }, [theme]);

  // Get the colors for the reader
  const getReaderThemeColors = useMemo(() => {
    return () => getReaderColors(theme);
  }, [theme]);

  // Build the context value object, only re-create when any dependencies change
  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      customTheme,
      getAgentColors: getAgentThemeColors,
      getUIColors,
      getReaderColors: getReaderThemeColors,
    }),
    [
      theme,
      customTheme,
      getAgentThemeColors,
      getUIColors,
      getReaderThemeColors,
    ],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Use the theme custom hook
 * Provides access to the theme state and colors
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
