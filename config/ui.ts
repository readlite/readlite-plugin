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
  available?: boolean; // Whether this font is available (default: true)
}

/**
 * Font options with multilingual labels
 * This is the primary source of font configurations used throughout the application
 * All font-related UI elements should reference this array
 */
export const fontOptions: FontOption[] = [
  // --- CJK Serif / Mixed reading (bundled) ---
  {
    value:
      '"LXGW WenKai", "Noto Serif", "Source Serif 4", "Songti SC", SimSun, serif',
    label: { zh: "霞鹜文楷 / LXGW WenKai", en: "LXGW WenKai" },
  },

  // --- Latin Serif ---
  {
    value: '"Literata", Georgia, "Times New Roman", serif',
    label: { zh: "Literata", en: "Literata" },
  },
  {
    value: '"Source Serif 4", "Literata", Georgia, "Times New Roman", serif',
    label: { zh: "Source Serif 4", en: "Source Serif 4" },
  },
  {
    value: '"Noto Serif", "Source Serif 4", Georgia, "Times New Roman", serif',
    label: { zh: "Noto Serif", en: "Noto Serif" },
  },
  {
    value: "Georgia, \"Times New Roman\", Times, serif",
    label: { zh: "Georgia", en: "Georgia" },
  },

  // --- Latin Sans ---
  {
    value: "\"Noto Sans\", Arial, sans-serif",
    label: { zh: "Noto Sans", en: "Noto Sans" },
  },
  {
    value:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif',
    label: { zh: "系统无衬线", en: "System UI Sans" },
  },

  // --- Mono ---
  {
    value:
      '"JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
    label: { zh: "JetBrains Mono", en: "JetBrains Mono" },
  },
  {
    value:
      '"FiraCode Nerd Font Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
    label: { zh: "FiraCode Nerd Font Mono", en: "FiraCode Nerd Font Mono" },
  },
  {
    value: '"Noto Sans Mono", Menlo, Consolas, monospace',
    label: { zh: "Noto Sans Mono", en: "Noto Sans Mono" },
  },
  {
    value:
      'Menlo, "SF Mono", Monaco, Consolas, "Liberation Mono", monospace',
    label: { zh: "Menlo / SF Mono", en: "Menlo / SF Mono" },
  },

  // --- Accessibility ---
  {
    value: '"OpenDyslexic", "Noto Sans", Arial, sans-serif',
    label: { zh: "OpenDyslexic（阅读障碍友好）", en: "OpenDyslexic" },
    available: true,
  },
];

// Width options with visual representation
export const widthOptions = [
  { value: 0.30, label: { zh: "窄版", en: "Narrow" }, widthClass: "narrow" },    // 30% viewport
  { value: 0.50, label: { zh: "标准", en: "Standard" }, widthClass: "standard" }, // 50% viewport
  { value: 0.70, label: { zh: "加宽", en: "Wide" }, widthClass: "wide" },        // 70% viewport
  { value: 1.00, label: { zh: "满屏", en: "Full" }, widthClass: "full" },        // 100% viewport
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
