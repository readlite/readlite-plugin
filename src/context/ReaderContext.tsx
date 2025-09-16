import React, {
  createContext,
  useState,
  ReactNode,
  useContext,
  useCallback,
} from "react";
// Removed unused imports: useEffect, LanguageCode
import { useArticle } from "../hooks/useArticle";
import { useStoredSettings } from "../hooks/useStoredSettings";
import { createLogger } from "~/utils/logger";
import { ThemeType } from "../config/theme";
import { ThemeProvider } from "./ThemeContext";
import { BookOpenIcon } from "@heroicons/react/24/outline";

// Create a logger for this module
const logger = createLogger("reader-context");

// --- Types & Defaults ---

// Main settings type
// Removed LanguageSettings and LanguageSettingsMap as per-language overrides are currently not implemented in setters.
export interface ReaderSettings {
  theme: ThemeType;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  width: number;
  spacing: "tight" | "normal" | "relaxed";
  textAlign: "left" | "justify" | "right" | "center";
  trackingEnabled: boolean; // For potential future analytics
  version: number; // For settings migrations
}

// Default settings for reader
export const defaultSettings: ReaderSettings = {
  theme: "light",
  fontFamily: "", // Empty string to allow language-specific default
  fontSize: 18,
  lineHeight: 1.6,
  width: 700, // Standard width
  spacing: "normal",
  textAlign: "left",
  trackingEnabled: false,
  version: 1,
};

// Define the structure for the extracted article data
// Based on Mercury parser output structure
export interface ArticleData {
  title: string;
  content: string; // HTML content
  author?: string;
  date?: string;
  siteName?: string;
  textContent?: string; // Plain text version
  excerpt?: string;
  length?: number;
  byline?: string;
  dir?: string; // Text direction (e.g., 'ltr', 'rtl')
  language?: string; // Detected language code (e.g., 'en', 'zh')
}

// Type for the context value
export interface ReaderContextType {
  article: ArticleData | null;
  settings: ReaderSettings;
  isLoading: boolean; // Loading state for article extraction
  error: string | null; // Error message from article extraction
  isSettingsLoaded: boolean; // Status from useStoredSettings
  updateSettings: (newSettings: Partial<ReaderSettings>) => void; // From useStoredSettings
  resetSettings: () => void; // From useStoredSettings
  closeReader: () => void; // Function to trigger reader close
  loadArticle: () => Promise<void>; // Explicit function to load the article
}

// --- Context Definition ---

// Create context with default/placeholder values
export const ReaderContext = createContext<ReaderContextType>({
  article: null,
  settings: defaultSettings,
  isLoading: false,
  error: null,
  isSettingsLoaded: false,
  updateSettings: () =>
    logger.warn("updateSettings called before Provider mounted"),
  resetSettings: () =>
    logger.warn("resetSettings called before Provider mounted"),
  closeReader: () => logger.warn("closeReader called before Provider mounted"),
  loadArticle: async () =>
    logger.warn("loadArticle called before Provider mounted"),
});

// Hook to easily consume the context
export const useReader = () => useContext(ReaderContext);

// --- Provider Component ---

// Add props interface for ReaderProvider
interface ReaderProviderProps {
  children: ReactNode;
  initialTheme?: ThemeType; // Add initialTheme prop here
}

// Simple loading indicator shown while settings are loading
const LoadingIndicator: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
      backgroundColor: "#f0f0f0",
      color: "#555",
      fontSize: "16px",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <BookOpenIcon
        style={{
          width: "40px",
          height: "40px",
          marginBottom: "10px",
          opacity: 0.6,
        }}
      />
      <div>Loading Reader Settings...</div>
    </div>
  </div>
);

/**
 * Provider component for the Reader Context.
 * Manages fetching stored settings, extracting article content, and providing
 * state and update functions to child components.
 */
export const ReaderProvider: React.FC<ReaderProviderProps> = ({
  children,
  initialTheme,
}) => {
  // --- State & Hooks ---

  // Settings state managed by useStoredSettings (handles loading from chrome.storage)
  const {
    settings,
    updateSettings,
    isLoaded: isSettingsLoaded,
    resetSettings,
  } = useStoredSettings();

  // State for article extraction
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Start not loading until explicitly requested
  const [error, setError] = useState<string | null>(null);

  // Hook providing the article extraction function
  const { extractArticle } = useArticle();

  /**
   * Function to load the article content explicitly when requested
   * (triggered by user action rather than automatically on mount)
   */
  const loadArticle = useCallback(async () => {
    // Only proceed if settings are loaded
    if (!isSettingsLoaded) {
      logger.warn("Attempted to load article before settings were loaded");
      return;
    }

    logger.info("Starting article extraction...");
    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      const extractedArticle = await extractArticle();
      if (extractedArticle) {
        logger.info(
          `Article extracted successfully: "${extractedArticle.title?.substring(0, 50)}..."`,
        );
        setArticle(extractedArticle);
      } else {
        logger.warn("Article extraction returned null or undefined.");
        setError("Could not extract article content from this page.");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unknown error during article extraction";
      logger.error("Error extracting article:", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isSettingsLoaded, extractArticle]);

  // No automatic article loading in useEffect
  // Instead, loadArticle will be called explicitly when needed

  /**
   * Callback function to close the reader mode.
   * Dispatches a custom event handled by the content script.
   */
  const closeReader = useCallback(() => {
    logger.info("Dispatching close event (READLITE_TOGGLE_INTERNAL).");
    document.dispatchEvent(new CustomEvent("READLITE_TOGGLE_INTERNAL"));
  }, []);

  // --- Context Value ---

  // Assemble the context value object
  const value: ReaderContextType = {
    article,
    settings,
    isLoading,
    error,
    isSettingsLoaded,
    updateSettings,
    resetSettings,
    closeReader,
    loadArticle,
  };

  // --- Render ---

  return (
    <ReaderContext.Provider value={value}>
      {/* Show loading indicator until settings are loaded */}
      {isSettingsLoaded ? (
        <ThemeProvider
          initialTheme={initialTheme}
          currentTheme={settings.theme}
        >
          {children}
        </ThemeProvider>
      ) : (
        <LoadingIndicator />
      )}
    </ReaderContext.Provider>
  );
};
