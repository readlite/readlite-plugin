import React, { createContext, useContext, useMemo, ReactNode } from "react";
import { getBrowserLanguage, getMessage } from "../utils/i18n";

// --- Types ---

interface I18nContextType {
  uiLanguage: string; // The language used for the extension's UI
  t: (key: string) => string; // Translation function
}

// --- Context Definition ---

const I18nContext = createContext<I18nContextType | null>(null);

// --- Provider Component ---

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Provides internationalization context (UI language and translation function).
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  // Determine the UI language based on browser/OS settings
  const uiLanguage = getBrowserLanguage();

  // Memoize the translation function `t` to optimize performance.
  // It depends only on the `uiLanguage`.
  const t = useMemo(() => {
    return (key: string): string => {
      try {
        // 1. Attempt to get translation in the detected UI language
        const message = getMessage(key, uiLanguage);

        // 2. If not found and language is not English, try English as a fallback
        if (!message && uiLanguage !== "en") {
          const fallbackMessage = getMessage(key, "en");
          // 3. If English fallback also fails, return the key itself
          return fallbackMessage || key;
        }

        // 4. If found in original language, or if English was the original language and failed, return message or key
        return message || key;
      } catch (error) {
        // 5. Return the key in case of any unexpected errors during translation
        return key;
      }
    };
  }, [uiLanguage]);

  // Memoize the context value object
  const value = useMemo(
    () => ({
      uiLanguage,
      t,
    }),
    [uiLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// --- Hook ---

/**
 * Hook to consume the I18n context.
 * Provides the UI language and the translation function `t`.
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    // This error prevents using the hook outside of the provider tree
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
