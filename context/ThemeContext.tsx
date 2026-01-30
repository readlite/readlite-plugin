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
  getPreferredTheme,
  saveTheme,
  setupThemeChangeListener,
} from "../utils/themeManager";

const logger = createLogger("theme-context");

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
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
      logger.info(`Theme changed to: ${newTheme}`);
      saveTheme(newTheme);
      setThemeState(newTheme);
    } else {
      logger.warn(`Invalid theme requested: ${newTheme}`);
    }
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
      themeColors,
      getUIColors,
      getReaderColors: getReaderThemeColors,
    }),
    [theme, getUIColors, getReaderThemeColors],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
