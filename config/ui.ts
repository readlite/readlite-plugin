/**
 * Font Configurations and UI Options for ReadLite
 * Following ISO 639-1 language codes for standardization
 *
 * This file is the single source of truth for:
 * 1. Font configurations and options
 * 2. Layout and display options
 * 3. Language display configurations
 */
import { LanguageCode } from "@/utils/language"; // Use alias

// Font naming that includes both language options
export interface FontLabel {
  zh: string;
  en: string;
}

/**
 * Font option structure
 * Core interface for all font configurations in the application
 * This replaces the older FontDisplayConfig interface and centralizes all font management
 */
export interface FontOption {
  value: string; // CSS font-family value
  label: FontLabel; // Localized display names in different languages
  compatibleLanguages: string[]; // Languages this font supports, first one is primary
  available?: boolean; // Whether this font is available (default: true)
}

/**
 * Font options with multilingual labels
 * This is the primary source of font configurations used throughout the application
 * All font-related UI elements should reference this array
 */
export const fontOptions: FontOption[] = [
  // Chinese fonts - 3 essential options
  {
    value:
      '"Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    label: { zh: "思源黑体", en: "Source Han Sans" },
    compatibleLanguages: ["zh", "ja", "ko", "cmn", "wuu", "yue"],
    available: true,
  },
  {
    value: '"PingFang SC", "苹方", "-apple-system", sans-serif',
    label: { zh: "苹方", en: "PingFang" },
    compatibleLanguages: ["zh", "cmn", "wuu", "yue"],
    available: true,
  },
  {
    value: '"Source Han Serif SC", "Noto Serif SC", serif',
    label: { zh: "思源宋体", en: "Source Han Serif" },
    compatibleLanguages: ["zh", "ja", "ko", "cmn", "wuu", "yue"],
    available: true,
  },

  // English fonts - 3 essential options
  {
    value: '"Georgia", serif',
    label: { zh: "Georgia", en: "Georgia" },
    compatibleLanguages: ["en", "fr", "de", "es", "it", "ru"],
    available: true,
  },
  {
    value: '"Palatino", "Palatino Linotype", serif',
    label: { zh: "Palatino", en: "Palatino" },
    compatibleLanguages: ["en", "fr", "de", "es", "it", "ru"],
    available: true,
  },
  {
    value: '"Arial", "Helvetica", sans-serif',
    label: { zh: "Arial", en: "Arial" },
    compatibleLanguages: ["en", "fr", "de", "es", "it", "ru"],
    available: true,
  },
];

// Width options with visual representation
export const widthOptions = [
  { value: 640, label: { zh: "窄", en: "Narrow" }, widthClass: "narrow" },
  { value: 768, label: { zh: "标准", en: "Standard" }, widthClass: "standard" },
  { value: 960, label: { zh: "宽", en: "Wide" }, widthClass: "wide" },
];

// Spacing options with visual representation
export const spacingOptions = [
  {
    value: "tight" as const,
    label: { zh: "紧凑", en: "Tight" },
    lineHeight: 1.5,
    spacingClass: "tight",
  },
  {
    value: "normal" as const,
    label: { zh: "标准", en: "Normal" },
    lineHeight: 1.75,
    spacingClass: "normal",
  },
  {
    value: "relaxed" as const,
    label: { zh: "宽松", en: "Relaxed" },
    lineHeight: 2.0,
    spacingClass: "relaxed",
  },
];

// Define text alignment options
export const alignmentOptions = [
  { label: { en: "Left", zh: "左对齐" }, value: "left" },
  { label: { en: "Justify", zh: "两端对齐" }, value: "justify" },
];

// Language display configuration
export interface LanguageDisplayConfig {
  code: LanguageCode; // Language code (e.g. 'en', 'zh')
  displayNames: {
    // Localized display names
    [key in LanguageCode]?: string;
  };
  fontSectionTitle?: {
    // Font section title when this language is detected
    [key in LanguageCode]?: string;
  };
  fallback?: string; // Fallback display name
}

// Language display configuration mapping
export const languageDisplayConfigs: LanguageDisplayConfig[] = [
  // English
  {
    code: "en",
    displayNames: {
      en: "English",
      zh: "英文",
    },
    fontSectionTitle: {
      en: "English Fonts",
      zh: "英文字体",
    },
  },
  // Chinese
  {
    code: "zh",
    displayNames: {
      en: "Chinese",
      zh: "中文",
    },
    fontSectionTitle: {
      en: "Chinese Fonts",
      zh: "中文字体",
    },
  },
];
