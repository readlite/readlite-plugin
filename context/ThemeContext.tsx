import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  ThemeType,
  ThemeColors,
  themeTokens,
  getThemeColors,
  getSettingsColors,
  getReaderColors,
  AVAILABLE_THEMES,
} from "../config/theme";
import { createLogger } from "@/utils/logger";
import {
  applyThemeGlobally,
  getPreferredTheme,
  saveTheme,
  setupThemeChangeListener,
} from "../utils/themeManager";

const logger = createLogger("theme-context");

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  customTheme: string | null;
  setCustomTheme: (themeJson: string) => void;
  themeColors: ThemeColors;
  getUIColors: () => any;
  getReaderColors: () => any;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeType;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
}) => {
  // Use initial theme if provided, otherwise try to get from storage or default
  // Note: For initial render, we need a synchronous value to avoid flash
  const [theme, setThemeState] = useState<ThemeType>(() => {
    if (initialTheme && AVAILABLE_THEMES.includes(initialTheme)) {
      return initialTheme;
    }
    return getPreferredTheme();
  });

  // Sync state with prop if it changes (driven by ReaderContext/Settings)
  useEffect(() => {
    if (initialTheme && AVAILABLE_THEMES.includes(initialTheme) && initialTheme !== theme) {
      setThemeState(initialTheme);
    }
  }, [initialTheme]);

  const [customTheme, setCustomThemeState] = useState<string | null>(null);

  // Apply theme when it changes
  useEffect(() => {
    logger.info(`Theme changed to: ${theme}`);
    // We don't call applyThemeGlobally here directly anymore because:
    // 1. content.tsx listens for storage events and applies theme to the Shadow Root/Container.
    // 2. Calling it here with default args would target 'document' (the host page), which we want to avoid.
    saveTheme(theme);
  }, [theme]);

  // Handle custom theme changes
  useEffect(() => {
    if (customTheme) {
      // Logic for custom theme would go here
      // For now we just rely on the theme manager to handle custom theme via local storage
    }
  }, [customTheme]);

  // Listen for storage changes (e.g. from other tabs or popup)
  useEffect(() => {
    // Use the utility function to set up the listener
    // We pass document just as a dummy root because we only care about the callback
    const cleanup = setupThemeChangeListener(document, (newTheme) => {
      logger.info(`Theme synced from storage: ${newTheme}`);
      setThemeState((currentTheme) => {
        // Prevent infinite loops by only updating if actually changed
        if (currentTheme !== newTheme) {
            return newTheme;
        }
        return currentTheme;
      });
    });

    return cleanup;
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    if (AVAILABLE_THEMES.includes(newTheme)) {
      setThemeState(newTheme);
    } else {
      logger.warn(`Invalid theme requested: ${newTheme}`);
    }
  };

  const setCustomTheme = (themeJson: string) => {
    setCustomThemeState(themeJson);
    // Custom theme application is handled by ThemeSection component saving to localStorage
    // and themeManager reading it when theme is set to 'custom'
  };

  // Memoize values to prevent unnecessary re-renders
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  // Get UI specific colors - use useMemo to optimize performance
  const getUIColors = useMemo(() => {
    return () => getSettingsColors(theme);
  }, [theme]);

  // Get Reader specific colors - use useMemo to optimize performance
  const getReaderThemeColors = useMemo(() => {
    return () => getReaderColors(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      customTheme,
      setCustomTheme,
      themeColors,
      getUIColors,
      getReaderColors: getReaderThemeColors,
    }),
    [theme, customTheme, getUIColors, getReaderThemeColors],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
