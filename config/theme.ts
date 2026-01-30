import { createLogger } from "../utils/logger";

const logger = createLogger("theme-config");

/**
 * Theme configuration system
 * Implementing dynamic theme switching using CSS variables, compatible with Tailwind
 */

// Define centralized list of available themes (aligned to design spec)
export const AVAILABLE_THEMES: ThemeType[] = [
  "ink",
  "obsidian",
  "ceramic",
  "classic",
  "bamboo",
  "phantom",
];

// Preferred ordering for UI display (ink first, then obsidian)
export const DISPLAY_THEMES: ThemeType[] = [
  "ink",
  "obsidian",
  "ceramic",
  "bamboo",
  "classic",
  "phantom",
];

export type ThemeType =
  | "classic"
  | "obsidian"
  | "bamboo"
  | "ceramic"
  | "ink"
  | "phantom";

// Map legacy theme names to the new palette keys
export const LEGACY_THEME_MAP: Record<string, ThemeType> = {
  parchment: "classic",
  inkstone: "obsidian",
  sage: "bamboo",
  nordic: "ceramic",
  mono: "ink",
  iris: "phantom",
};

// Normalize any incoming theme value (from legacy storage or user input)
export const normalizeTheme = (theme?: string | null): ThemeType => {
  if (!theme) return "ink";
  if (AVAILABLE_THEMES.includes(theme as ThemeType)) {
    return theme as ThemeType;
  }
  const mapped = LEGACY_THEME_MAP[theme];
  return mapped || "ink";
};

// Main theme colors interface
export interface ThemeColors {
  bg: {
    primary: string; // Main background
    secondary: string; // Sidebar/Toolbar background
    tertiary: string; // Subtle background
    user: string; // User message background (kept if needed for future UI)
    input: string; // Input field background
  };
  text: {
    primary: string; // Main text
    secondary: string; // Secondary text
    user: string; // User message text
    accent: string; // Accent text
  };
  ui: {
    border: string; // Border color
    accent: string; // Accent/Brand color (blue)
    error: string; // Error color (red)
  };
  highlight: {
    beige: string;
    cyan: string;
    lavender: string;
    olive: string;
    peach: string;
    selection: string; // Default selection color
    selectionHover: string;
  };
  link: {
    normal: string;
    hover: string;
  };
}

// Color tokens for each theme (aligned to spec)
export const themeTokens: Record<ThemeType, ThemeColors> = {
  classic: {
    bg: {
      primary: "#FBF6EA",
      secondary: "#FFFDF7",
      tertiary: "#F4EBDD",
      user: "#FFFDF7",
      input: "#FFFFFF",
    },
    text: {
      primary: "#2A241E",
      secondary: "#5B5248",
      user: "#2A241E",
      accent: "#A45D17",
    },
    ui: {
      border: "#E3D7C6",
      accent: "#A45D17",
      error: "#C75B50",
    },
    highlight: {
      beige: "#FCEFB4",
      cyan: "#D6E9F5",
      lavender: "#E3DAF1",
      olive: "#E0E7D1",
      peach: "#F7D9C2",
      selection: "#E9D8BD",
      selectionHover: "#E9D8BD",
    },
    link: {
      normal: "#A45D17",
      hover: "#8F4F13",
    },
  },
  obsidian: {
    bg: {
      primary: "#000000",
      secondary: "#0B0B0C",
      tertiary: "#161618",
      user: "#0B0B0C",
      input: "#0B0B0C",
    },
    text: {
      primary: "#E6E6E6",
      secondary: "#B0B0B2",
      user: "#E6E6E6",
      accent: "#C58B3A",
    },
    ui: {
      border: "#2A2A2D",
      accent: "#C58B3A",
      error: "#F87171",
    },
    highlight: {
      beige: "#4A3818",
      cyan: "#1A3B5C",
      lavender: "#B59CFF",
      olive: "#1A3B5C",
      peach: "#4A3818",
      selection: "#1A3B5C",
      selectionHover: "#1A3B5C",
    },
    link: {
      normal: "#7AC8FF",
      hover: "#B59CFF",
    },
  },
  bamboo: {
    bg: {
      primary: "#F3F7EF",
      secondary: "#FAFCF8",
      tertiary: "#E6EFE0",
      user: "#FAFCF8",
      input: "#FFFFFF",
    },
    text: {
      primary: "#24331C",
      secondary: "#495940",
      user: "#24331C",
      accent: "#55752E",
    },
    ui: {
      border: "#D8E0CE",
      accent: "#55752E",
      error: "#B85C5C",
    },
    highlight: {
      beige: "#E8F5C8",
      cyan: "#DCECC8",
      lavender: "#D9E0DA",
      olive: "#D6E2C8",
      peach: "#E7D6C8",
      selection: "#DCECC8",
      selectionHover: "#DCECC8",
    },
    link: {
      normal: "#466E1D",
      hover: "#3D5520",
    },
  },
  ceramic: {
    bg: {
      primary: "#F2F5F9",
      secondary: "#FFFFFF",
      tertiary: "#E6ECF5",
      user: "#FFFFFF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#1C2530",
      secondary: "#465565",
      user: "#1C2530",
      accent: "#2B6CA3",
    },
    ui: {
      border: "#D6DEE9",
      accent: "#2B6CA3",
      error: "#D05C5C",
    },
    highlight: {
      beige: "#FFF5CC",
      cyan: "#D1E3F6",
      lavender: "#E5D9FF",
      olive: "#E6F2C4",
      peach: "#FFD9C4",
      selection: "#D1E3F6",
      selectionHover: "#D1E3F6",
    },
    link: {
      normal: "#2B6CA3",
      hover: "#235885",
    },
  },
  ink: {
    bg: {
      primary: "#F8F8F8",
      secondary: "#FFFFFF",
      tertiary: "#EDEDED",
      user: "#FFFFFF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#111111",
      secondary: "#262626",
      user: "#111111",
      accent: "#111111",
    },
    ui: {
      border: "#CFCFCF",
      accent: "#111111",
      error: "#B00020",
    },
    highlight: {
      beige: "#FFFF00",
      cyan: "#C7EBFF",
      lavender: "#E5D9FF",
      olive: "#E6F2C4",
      peach: "#FFD9C4",
      selection: "#222222",
      selectionHover: "#222222",
    },
    link: {
      normal: "#0F3DAD",
      hover: "#4B2F73",
    },
  },
  phantom: {
    bg: {
      primary: "#F2F1F6",
      secondary: "#FFFFFF",
      tertiary: "#E9E8EE",
      user: "#FFFFFF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#2E2C36",
      secondary: "#5C5866",
      user: "#2E2C36",
      accent: "#68608F",
    },
    ui: {
      border: "#DBD9E0",
      accent: "#68608F",
      error: "#C44F7A",
    },
    highlight: {
      beige: "#EBD4F4",
      cyan: "#E0DEED",
      lavender: "#E0DEED",
      olive: "#E4E2E8",
      peach: "#EBD4F4",
      selection: "#E0DEED",
      selectionHover: "#E0DEED",
    },
    link: {
      normal: "#5856D6",
      hover: "#4845AB",
    },
  },
};

/**
 * Get color tokens for a specific theme
 * @param theme The theme type
 * @returns The theme colors object
 */
export function getThemeColors(theme: ThemeType): ThemeColors {
  const normalized = normalizeTheme(theme);
  return themeTokens[normalized];
}

/**
 * Get setting panel colors based on the provided theme type
 * @param theme The theme type
 * @returns An object containing colors for settings panel
 */
export function getSettingsColors(theme: ThemeType) {
  const normalized = normalizeTheme(theme);
  const tokens = getThemeColors(normalized);
  const isDarkLike = normalized === "obsidian";
  return {
    background: tokens.bg.secondary,
    text: tokens.text.primary,
    border: tokens.ui.border,
    activeButtonBg: tokens.ui.accent,
    activeButtonText: "#FFFFFF",
    inactiveButtonBg: isDarkLike ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    hoverButtonBg: isDarkLike ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
  };
}

/**
 * Get reader content colors based on the provided theme type
 * @param theme The theme type
 * @returns An object containing colors for reader UI
 */
export function getReaderColors(theme: ThemeType) {
  const tokens = getThemeColors(normalizeTheme(theme));
  return {
    background: tokens.bg.primary,
    text: tokens.text.primary,
    secondaryText: tokens.text.secondary,
    link: tokens.link,
  };
}
