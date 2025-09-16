/**
 * ReadLite Theme System - Unified management of all theme colors
 * Implementing dynamic theme switching using CSS variables, compatible with Tailwind
 */

// Define supported theme types
export type ThemeType = "light" | "dark" | "eyecare" | "custom";

// Define centralized list of available themes
export const AVAILABLE_THEMES: ThemeType[] = [
  "light",
  "dark",
  "eyecare",
  "custom",
];

// Agent UI colors interface
export interface AgentColors {
  background: string;
  messageBg: string;
  userBubble: string;
  agentBubble: string;
  inputBg: string;
  text: string;
  textUser: string;
  textAgent: string;
  textSecondary: string;
  accent: string;
  border: string;
  error: string;
  scrollbar: string;
  scrollbarHover: string;
  chipBg: string;
  thinkingPulse: string;
}

// Settings panel colors interface
export interface SettingsColors {
  bg: string; // Background color
  text: string; // Text color
  border: string; // Border color
  highlight: string; // Highlight color for active elements
  buttonBg: string; // Button background color
  buttonText: string; // Button text color
}

// Reader colors interface
export interface ReaderColors {
  background: string; // Background color
  text: string; // Main text color
  title: string; // Title text color
  border: string; // Border color
  toolbar: {
    background: string; // Toolbar background
    border: string; // Toolbar border
  };
  link: {
    normal: string; // Link color
    visited: string; // Visited link color
    hover: string; // Hover link color
    active: string; // Active link color
  };
}

// Theme color tokens - Define all color variables
interface ColorTokens {
  // Background colors
  bg: {
    primary: string; // Main background
    secondary: string; // Secondary background
    tertiary: string; // Tertiary background
    user: string; // User message background
    agent: string; // Agent message background
    input: string; // Input field background
  };

  // Text colors
  text: {
    primary: string; // Primary text
    secondary: string; // Secondary text
    user: string; // User message text
    agent: string; // Agent message text
    accent: string; // Accent text
  };

  // Borders and decorations
  border: string; // Border
  accent: string; // Accent color
  error: string; // Error color

  // Scrollbar
  scrollbar: {
    track: string; // Scrollbar track
    thumb: string; // Scrollbar thumb
  };

  // Link colors
  link: {
    normal: string; // Normal link
    visited: string; // Visited link
    hover: string; // Hover link
    active: string; // Active link
  };
}

// 2025 Flagship – Reading × Minimalism Palette (OKLCH‑driven, WCAG‑compliant)
// -------------------------------------------------------------
// 1. Light  : "SILK"      – Daytime reading / Paper white + Cloud blue
// 2. Dark   : "CARBON"    – Nighttime reading / Deep carbon + Mist blue
// 3. Eyecare: "SEPIA"     – Long-term eye care / Old book rice + Bronze brown
// 4. Custom : "PRISM"     – User-defined accent (other inherit Light)
// -------------------------------------------------------------

/**
 * All theme token collection
 * All color values are first determined in the OKLCH space, then converted to Hex, ensuring perceptual consistency
 */
export const themeTokens: Record<ThemeType, ColorTokens> = {
  /* ------------------------------------------------ LIGHT (SILK) ------------------------------------------------ */
  light: {
    bg: {
      primary: "#FFFFFF",
      secondary: "#F9F9F9",
      tertiary: "#ECEAE7",
      user: "#F1EFEC",
      agent: "#FFFFFF",
      input: "#FFFFFF",
    },
    text: {
      primary: "#242628",
      secondary: "#5A5F66",
      user: "#242628",
      agent: "#242628",
      accent: "#3A7D7C",
    },
    border: "#DFDDD9",
    accent: "#3A7D7C",
    error: "#D94A3A",
    scrollbar: {
      track: "#EAE8E4",
      thumb: "#D4D1CC",
    },
    link: {
      normal: "#2680FF",
      visited: "#195DD1",
      hover: "#3B8EFF",
      active: "#1247A0",
    },
  },

  /* ------------------------------------------------ DARK (CARBON) ------------------------------------------------ */
  dark: {
    bg: {
      primary: "#161718",
      secondary: "#1E1F20",
      tertiary: "#262729",
      user: "#2E2F31",
      agent: "#161718",
      input: "#1E1F20",
    },
    text: {
      primary: "#E7EBF1",
      secondary: "#A5AEBF",
      user: "#E7EBF1",
      agent: "#E7EBF1",
      accent: "#7FA6FF",
    },
    border: "#1A1B1D",
    accent: "#7FA6FF",
    error: "#FF6F6F",
    scrollbar: {
      track: "#2B2D2F",
      thumb: "#3B3D40",
    },
    link: {
      normal: "#7FA6FF",
      visited: "#AAA1FF",
      hover: "#5E8CFF",
      active: "#4771DB",
    },
  },

  /* ------------------------------------------------ EYECARE (SEPIA) ---------------------------------------------- */
  eyecare: {
    bg: {
      primary: "#F7F3E7",
      secondary: "#EFEADF",
      tertiary: "#E7E1D6",
      user: "#EFEADF",
      agent: "#F7F3E7",
      input: "#FFFFFF",
    },
    text: {
      primary: "#3B3226",
      secondary: "#6B5F51",
      user: "#3B3226",
      agent: "#3B3226",
      accent: "#A05B3C",
    },
    border: "#DCD4C8",
    accent: "#A05B3C",
    error: "#C46A4C",
    scrollbar: {
      track: "#DCD4C8",
      thumb: "#C9C0B3",
    },
    link: {
      normal: "#8B6C40",
      visited: "#6B5231",
      hover: "#A27C46",
      active: "#5E482A",
    },
  },

  /* ------------------------------------------------ CUSTOM (PRISM) ------------------------------------------------ */
  custom: {
    bg: {
      primary: "#FEFCFA",
      secondary: "#F6F4F2",
      tertiary: "#ECEAE7",
      user: "#F1EFEC",
      agent: "#FEFCFA",
      input: "#FFFFFF",
    },
    text: {
      primary: "#242628",
      secondary: "#5A5F66",
      user: "#242628",
      agent: "#242628",
      accent: "#7C4DFF",
    },
    border: "#DFDDD9",
    accent: "#7C4DFF",
    error: "#D94A3A",
    scrollbar: {
      track: "#EAE8E4",
      thumb: "#D4D1CC",
    },
    link: {
      normal: "#7C4DFF",
      visited: "#6B3ACF",
      hover: "#9670FF",
      active: "#5E3DBD",
    },
  },
};

// Generate CSS variable names mapping from color tokens
export const cssVarNames = {
  bg: {
    primary: "--readlite-bg-primary",
    secondary: "--readlite-bg-secondary",
    tertiary: "--readlite-bg-tertiary",
    user: "--readlite-bg-user",
    agent: "--readlite-bg-agent",
    input: "--readlite-bg-input",
  },
  text: {
    primary: "--readlite-text-primary",
    secondary: "--readlite-text-secondary",
    user: "--readlite-text-user",
    agent: "--readlite-text-agent",
    accent: "--readlite-text-accent",
  },
  border: "--readlite-border",
  accent: "--readlite-accent",
  error: "--readlite-error",
  scrollbar: {
    track: "--readlite-scrollbar-track",
    thumb: "--readlite-scrollbar-thumb",
  },
  link: {
    normal: "--readlite-link",
    visited: "--readlite-link-visited",
    hover: "--readlite-link-hover",
    active: "--readlite-link-active",
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
};

/**
 * Get agent UI colors based on the provided theme type
 *
 * @param theme The theme type (light, dark, sepia, or paper)
 * @returns An object containing agent UI colors
 */
export function getAgentColors(theme: ThemeType): AgentColors {
  const tokens = themeTokens[theme];

  return {
    background: tokens.bg.primary,
    messageBg: tokens.bg.secondary,
    userBubble: tokens.bg.user,
    agentBubble: tokens.bg.agent,
    inputBg: tokens.bg.input,
    text: tokens.text.primary,
    textUser: tokens.text.user,
    textAgent: tokens.text.agent,
    textSecondary: tokens.text.secondary,
    accent: tokens.accent,
    border: tokens.border,
    error: tokens.error,
    scrollbar: tokens.scrollbar.track,
    scrollbarHover: tokens.scrollbar.thumb,
    chipBg: tokens.bg.tertiary,
    thinkingPulse: addOpacity(tokens.accent, 0.3),
  };
}

/**
 * Get settings panel colors based on the provided theme type
 *
 * @param theme The theme type (light, dark, sepia, or paper)
 * @returns An object containing colors for settings panel
 */
export function getSettingsColors(theme: ThemeType): SettingsColors {
  const tokens = themeTokens[theme];

  return {
    bg: tokens.bg.primary,
    text: tokens.text.primary,
    border: tokens.border,
    highlight: tokens.accent,
    buttonBg: darkenColor(tokens.bg.primary, 3),
    buttonText: tokens.text.primary,
  };
}

/**
 * Get reader UI colors based on the provided theme type
 *
 * @param theme The theme type (light, dark, sepia, or paper)
 * @returns An object containing colors for reader UI
 */
export function getReaderColors(theme: ThemeType): ReaderColors {
  const tokens = themeTokens[theme];

  // Determine border color based on theme type
  const isDarkTheme = theme === "dark";
  const borderBaseColor = isDarkTheme ? "#FFFFFF" : "#000000";
  const borderOpacity = 0.02; // Reduced from 0.04 for even more subtle borders
  const toolbarBorderOpacity = 0.015; // Reduced for even subtler toolbar borders

  return {
    background: tokens.bg.primary,
    text: addOpacity(tokens.text.primary, 1),
    title: addOpacity(tokens.text.primary, 1),
    border: addOpacity(borderBaseColor, borderOpacity),
    toolbar: {
      background: addOpacity(tokens.bg.primary, 0.5),
      border: addOpacity(borderBaseColor, toolbarBorderOpacity),
    },
    link: tokens.link,
  };
}

// Helper function to convert hex to rgb for rgba values
function hexToRgb(hex: string): string {
  // Remove the hash if it exists
  hex = hex.replace("#", "");

  // Convert 3-digit hex to 6-digit hex
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  // Parse the hex values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  return `${r}, ${g}, ${b}`;
}

// Helper function to apply opacity to a color
function addOpacity(color: string, opacity: number): string {
  // If already rgba, just update the opacity
  if (color.startsWith("rgba(")) {
    return color.replace(
      /rgba\([^,]+,[^,]+,[^,]+,\s*[\d.]+\)/,
      `rgba($1, $2, $3, ${opacity})`,
    );
  }

  // If rgb, convert to rgba
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  }

  // If hex, convert to rgba
  if (color.startsWith("#")) {
    const rgb = hexToRgb(color);
    return `rgba(${rgb}, ${opacity})`;
  }

  // Default fallback
  return color;
}

// Helper function to darken a color
function darkenColor(color: string, percent: number): string {
  if (!color.startsWith("#")) return color;

  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.max(0, Math.floor(r * (1 - percent / 100)));
  g = Math.max(0, Math.floor(g * (1 - percent / 100)));
  b = Math.max(0, Math.floor(b * (1 - percent / 100)));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
