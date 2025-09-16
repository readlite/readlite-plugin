/**
 * i18n Utility Functions
 *
 * Provides functions for browser language detection, translation retrieval,
 * and getting language display names.
 */

import {
  LanguageCode,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES as ALL_SUPPORTED_LANGUAGES,
  isLanguageSupported,
} from "./language";
import { languageDisplayConfigs } from "../config/ui";

// --- Functions ---

/**
 * Get localized display name for a language code.
 * Uses configuration from `languageDisplayConfigs`.
 * @param langCode Language code to get display name for (e.g., 'en', 'zh').
 * @param uiLanguage Current UI language code (used to select the display name language).
 * @returns Localized display name for the language, or the code itself as fallback.
 */
export function getLanguageDisplayName(
  langCode: LanguageCode,
  uiLanguage: LanguageCode,
): string {
  const config = languageDisplayConfigs.find(
    (config) => config.code === langCode,
  );

  if (config) {
    // Return the localized display name, fallback to English, then code
    return (
      config.displayNames[uiLanguage] ||
      config.displayNames["en"] ||
      config.fallback ||
      langCode
    );
  }

  // If no config found, return the language code
  return langCode;
}

/**
 * Get localized font section title based on content language.
 * Uses configuration from `languageDisplayConfigs`.
 * @param contentLanguage Detected content language code.
 * @param uiLanguage Current UI language code.
 * @returns Localized font section title (e.g., "Chinese Fonts") or a generated fallback.
 */
export function getFontSectionTitle(
  contentLanguage: LanguageCode,
  uiLanguage: LanguageCode,
): string {
  const config = languageDisplayConfigs.find(
    (config) => config.code === contentLanguage,
  );

  if (config?.fontSectionTitle) {
    // Return the localized font section title, fallback to English, then generate default
    return (
      config.fontSectionTitle[uiLanguage] ||
      config.fontSectionTitle["en"] ||
      `${getLanguageDisplayName(contentLanguage, uiLanguage)} Fonts`
    );
  }

  // If no specific title found, construct one from the language name
  const defaultTitle = `${getLanguageDisplayName(contentLanguage, uiLanguage)} Fonts`;
  return defaultTitle;
}

/**
 * Get the browser's preferred UI language, normalized and validated against supported languages.
 * Uses the comprehensive list from language.ts.
 * @returns A supported LanguageCode (defaults to 'en').
 */
export function getBrowserLanguage(): LanguageCode {
  let detectedLang: LanguageCode = "en"; // Default
  try {
    const browserLang = navigator.language || (navigator as any).userLanguage;
    if (browserLang) {
      const normalizedLang = normalizeLanguageCode(browserLang);

      // Use the imported isLanguageSupported checker
      if (isLanguageSupported(normalizedLang)) {
        detectedLang = normalizedLang;
      } else {
        // Try base language code if regional variant wasn't supported
        const baseLang = normalizedLang.split("-")[0];
        if (isLanguageSupported(baseLang)) {
          detectedLang = baseLang;
        }
      }
    }
  } catch (e) {
    // Silent error, use default
  }
  return detectedLang;
}

/**
 * Get a translated string from locales files.
 * Uses locales/{lang}/messages.json files or falls back to English.
 *
 * @param key The translation key (must match messages.json).
 * @param lang Optional language code (defaults to browser language).
 * @returns The translated string, or the key itself if not found.
 */
export function getMessage(key: string, lang?: LanguageCode): string {
  // Use provided language or get browser language
  const language = lang || getBrowserLanguage();

  try {
    // If chrome.i18n not available or key not found, use local translations
    try {
      // Dynamic import of JSON files won't work in production
      // so we need to use a cache of translations instead
      return getLocalTranslation(key, language);
    } catch (localError) {
      // Try English as fallback if needed and not already using English
      if (language !== "en") {
        try {
          return getLocalTranslation(key, "en");
        } catch (fallbackError) {
          // Silent fallback error
        }
      }
    }

    // If all else fails, return the key
    return key;
  } catch (e) {
    // Silent error, return key
    return key;
  }
}

// Cache for loaded translations
const translationsCache: Record<string, any> = {};

/**
 * Get translation from local files based on language
 */
function getLocalTranslation(key: string, lang: LanguageCode): string {
  // Load and cache translations if not already loaded
  if (!translationsCache[lang]) {
    try {
      // In a real implementation, you'd have a mechanism to load these JSON files
      // Here we're directly importing or requiring common translations
      if (lang === "zh") {
        translationsCache.zh = require("../../locales/zh/messages.json");
      } else if (lang === "en") {
        translationsCache.en = require("../../locales/en/messages.json");
      } else {
        // For other languages, try loading if available or fall back to English
        try {
          translationsCache[lang] = require(
            `../../locales/${lang}/messages.json`,
          );
        } catch (e) {
          if (!translationsCache.en) {
            translationsCache.en = require("../../locales/en/messages.json");
          }
          return getLocalTranslation(key, "en");
        }
      }
    } catch (e) {
      throw e;
    }
  }

  // Return the translation if it exists
  const translation = translationsCache[lang]?.[key]?.message;
  if (translation) {
    return translation;
  }

  // Try fallback to English if not found and not already English
  if (lang !== "en") {
    if (!translationsCache.en) {
      try {
        translationsCache.en = require("../../locales/en/messages.json");
      } catch (e) {
        throw e;
      }
    }
    const enTranslation = translationsCache.en?.[key]?.message;
    if (enTranslation) {
      return enTranslation;
    }
  }

  // If still not found, return the key
  throw new Error(`Translation not found for key: ${key}`);
}
