// import { createLogger } from "../utils/logger";

// const logger = createLogger("theme-config"); // unused

/**
 * Theme configuration system
 * Implementing dynamic theme switching using CSS variables, compatible with Tailwind
 */

// Define centralized list of available themes
export const AVAILABLE_THEMES: ThemeType[] = [
  "light",
  "dark",
  "eyecare",
  "custom",
];

export type ThemeType = "light" | "dark" | "eyecare" | "custom";

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

// Color tokens for each theme
export const themeTokens: Record<ThemeType, ThemeColors> = {
  light: {
    bg: {
      primary: "#FFFFFF",
      secondary: "#F9FAFB",
      tertiary: "#F3F4F6",
      user: "#EFF6FF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#6B7280",
      user: "#1E3A8A",
      accent: "#2563EB",
    },
    ui: {
      border: "#E5E7EB",
      accent: "#3B82F6",
      error: "#EF4444",
    },
    highlight: {
      beige: "#FFF5E6",
      cyan: "#B5E4FF",
      lavender: "#DCC6FF",
      olive: "#DEEAB5",
      peach: "#FFCC99",
      selection: "rgba(59, 130, 246, 0.2)",
      selectionHover: "rgba(59, 130, 246, 0.3)",
    },
    link: {
      normal: "#2563EB",
      hover: "#1D4ED8",
    },
  },
  dark: {
    bg: {
      primary: "#1F2937",
      secondary: "#111827",
      tertiary: "#374151",
      user: "#1E3A8A",
      input: "#374151",
    },
    text: {
      primary: "#F9FAFB",
      secondary: "#9CA3AF",
      user: "#DBEAFE",
      accent: "#60A5FA",
    },
    ui: {
      border: "#374151",
      accent: "#3B82F6",
      error: "#EF4444",
    },
    highlight: {
      beige: "rgba(255, 245, 230, 0.3)",
      cyan: "rgba(181, 228, 255, 0.3)",
      lavender: "rgba(220, 198, 255, 0.3)",
      olive: "rgba(222, 234, 181, 0.3)",
      peach: "rgba(255, 204, 153, 0.3)",
      selection: "rgba(59, 130, 246, 0.3)",
      selectionHover: "rgba(59, 130, 246, 0.4)",
    },
    link: {
      normal: "#60A5FA",
      hover: "#93C5FD",
    },
  },
  eyecare: {
    bg: {
      primary: "#F7F3E8", // Warm parchment
      secondary: "#EFEADD",
      tertiary: "#E8E3D5",
      user: "#E6E0D0",
      input: "#FCF9F2",
    },
    text: {
      primary: "#4B4237", // Soft brown-black
      secondary: "#857A6B",
      user: "#3B3226",
      accent: "#8C6B4F", // Muted earth tone
    },
    ui: {
      border: "#D6CDBF",
      accent: "#8C6B4F",
      error: "#B85C5C", // Soft red
    },
    highlight: {
      beige: "#E6DAC8",
      cyan: "#CDE4DC",
      lavender: "#DCD4E0",
      olive: "#D8DECB",
      peach: "#E6D0C0",
      selection: "rgba(140, 107, 79, 0.15)",
      selectionHover: "rgba(140, 107, 79, 0.25)",
    },
    link: {
      normal: "#8C6B4F",
      hover: "#6B523D",
    },
  },
  custom: {
    // These are default values, they will be overridden by CSS variables at runtime
    bg: {
      primary: "#FFFFFF",
      secondary: "#F9FAFB",
      tertiary: "#F3F4F6",
      user: "#EFF6FF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#111827",
      secondary: "#6B7280",
      user: "#1E3A8A",
      accent: "#2563EB",
    },
    ui: {
      border: "--readlite-border",
      accent: "--readlite-accent",
      error: "--readlite-error",
    },
    highlight: {
      beige: "--readlite-highlight-beige",
      cyan: "--readlite-highlight-cyan",
      lavender: "--readlite-highlight-lavender",
      olive: "--readlite-highlight-olive",
      peach: "--readlite-highlight-peach",
      selection: "--readlite-highlight-selection",
      selectionHover: "--readlite-highlight-selection-hover",
    },
    link: {
      normal: "#2563EB",
      hover: "#1D4ED8",
    },
  },
};

/**
 * Get color tokens for a specific theme
 * @param theme The theme type (light, dark, eyecare, custom)
 * @returns The theme colors object
 */
export function getThemeColors(theme: ThemeType): ThemeColors {
  return themeTokens[theme] || themeTokens.light;
}

/**
 * Get setting panel colors based on the provided theme type
 * @param theme The theme type (light, dark, eyecare, custom)
 * @returns An object containing colors for settings panel
 */
export function getSettingsColors(theme: ThemeType) {
  const tokens = getThemeColors(theme);
  return {
    background: tokens.bg.secondary,
    text: tokens.text.primary,
    border: tokens.ui.border,
    activeButtonBg: tokens.ui.accent,
    activeButtonText: theme === "dark" ? "#FFFFFF" : "#FFFFFF",
    inactiveButtonBg:
      theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    hoverButtonBg:
      theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
  };
}

/**
 * Get reader content colors based on the provided theme type
 * @param theme The theme type (light, dark, eyecare, custom)
 * @returns An object containing colors for reader UI
 */
export function getReaderColors(theme: ThemeType) {
  const tokens = getThemeColors(theme);
  return {
    background: tokens.bg.primary,
    text: tokens.text.primary,
    secondaryText: tokens.text.secondary,
    link: tokens.link,
  };
}
