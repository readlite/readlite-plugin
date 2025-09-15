/**
 * Language detection utility functions
 */

// --- Types ---

// Define common language codes with ISO 639-1/639-2 standards
// Using `string` allows flexibility but primarily aims for ISO 639-1.
export type LanguageCode =
  | "zh"
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "it"
  | "ru"
  | string;

// --- Constants ---

// Languages explicitly supported by the extension's features (e.g., UI translations, specific font handling)
export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  "zh",
  "en",
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "it",
  "ru",
];

// Default language when no detection is available or normalization fails
export const DEFAULT_LANGUAGE: LanguageCode = "en";

// Mapping from franc-min ISO 639-3 codes to ISO 639-1
const FRANC_CODE_MAP: Record<string, LanguageCode> = {
  cmn: "zh", // Mandarin Chinese
  wuu: "zh", // Wu Chinese
  yue: "zh", // Cantonese
  eng: "en", // English
  jpn: "ja", // Japanese
  kor: "ko", // Korean
  fra: "fr", // French
  deu: "de", // German
  spa: "es", // Spanish
  ita: "it", // Italian
  rus: "ru", // Russian
  por: "pt", // Portuguese
  nld: "nl", // Dutch
  swe: "sv", // Swedish
  ara: "ar", // Arabic
  hin: "hi", // Hindi
  ben: "bn", // Bengali
  ind: "id", // Indonesian
  ell: "el", // Greek
  tur: "tr", // Turkish
  pol: "pl", // Polish
  ukr: "uk", // Ukrainian
  ron: "ro", // Romanian
  vie: "vi", // Vietnamese
  tha: "th", // Thai
  ces: "cs", // Czech
  hun: "hu", // Hungarian
  bul: "bg", // Bulgarian
  arb: "ar", // Standard Arabic
};

// Mapping for regional variants and other code formats
const REGION_CODE_MAP: Record<string, LanguageCode> = {
  // Chinese variants
  "zh-CN": "zh", // Simplified Chinese
  "zh-TW": "zh", // Traditional Chinese
  "zh-HK": "zh", // Hong Kong Chinese

  // English variants
  "en-US": "en", // American English
  "en-GB": "en", // British English
  "en-CA": "en", // Canadian English
  "en-AU": "en", // Australian English
};

// Combined map for all language code transformations
const LANGUAGE_CODE_MAP: Record<string, LanguageCode> = {
  ...FRANC_CODE_MAP,
  ...REGION_CODE_MAP,
};

// --- Functions ---

/**
 * Normalizes any language code to a standard format (preferring ISO 639-1).
 * Handles common variations like ISO 639-3 or regional codes.
 *
 * @param code The raw language code from detection (e.g., 'eng', 'en-US', 'zh-CN').
 * @returns A normalized language code ('en', 'zh') or the original code if no mapping exists.
 */
export function normalizeLanguageCode(code?: string | null): LanguageCode {
  if (!code) return DEFAULT_LANGUAGE;

  const lowerCode = code.toLowerCase(); // Normalize case for map lookup

  // 1. Check combined map (covers specific ISO 639-3 and common regional variants)
  if (lowerCode in LANGUAGE_CODE_MAP) {
    return LANGUAGE_CODE_MAP[lowerCode];
  }

  // 2. If code contains a region/script subtag (e.g., 'en-us', 'zh-hant'), extract the base code
  if (lowerCode.includes("-")) {
    const baseCode = lowerCode.split("-")[0];
    // Optional: Could check if baseCode is a known 2-letter code here
    return baseCode as LanguageCode;
  }

  // 3. If it's already a standard code (e.g., 'en', 'ja') or an unknown/unmapped code,
  // return it directly. Assume 2/3 letter codes without hyphens are base codes.
  return lowerCode as LanguageCode;
}

/**
 * Checks if a language code represents Chinese (simplified or traditional).
 *
 * @param code The language code to check.
 * @returns boolean indicating if the language is determined to be Chinese.
 */
export function isChineseLanguage(code?: string | null): boolean {
  if (!code) return false;
  // Normalize first to handle variants like 'cmn', 'yue', 'zh-CN', 'zh-TW'
  const normalizedCode = normalizeLanguageCode(code);
  // Check if the normalized code is 'zh'
  return normalizedCode === "zh";
}

/**
 * Checks if a language code is in the list of explicitly supported languages
 * for specific features within the extension.
 *
 * @param code The language code to check.
 * @returns boolean indicating if the language is listed in SUPPORTED_LANGUAGES.
 */
export function isLanguageSupported(code: LanguageCode): boolean {
  // Normalize the input code before checking against the supported list
  const normalizedCode = normalizeLanguageCode(code);
  return SUPPORTED_LANGUAGES.includes(normalizedCode);
}
