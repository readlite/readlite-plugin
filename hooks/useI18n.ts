/**
 * i18n Hook - Wrapper around WXT i18n for easier usage
 * 
 * Provides a simple interface to access translations.
 */
import { i18n } from '#i18n';

/**
 * Hook to access i18n translations
 * @returns Object with translation function and current UI language
 */
export function useI18n() {
  // Get UI locale from browser
  const uiLanguage = i18n.getUILanguage?.() || navigator.language || 'en';
  
  return {
    t: i18n.t.bind(i18n),
    uiLanguage,
  };
}

// Re-export i18n for direct usage
export { i18n };
