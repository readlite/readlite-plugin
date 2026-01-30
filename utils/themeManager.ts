/**
 * Theme Manager - Manages all theme-related functionality
 * Responsible for theme loading, saving, and application
 */

import {
  ThemeType,
  AVAILABLE_THEMES,
  themeTokens,
  normalizeTheme,
} from "../config/theme";
import { createLogger } from "./logger";

const logger = createLogger("theme-manager");

/**
 * Convert a CSS color string to space-separated RGB numbers for use in
 * Tailwind's `rgb(var(--token) / alpha)` pattern.
 */
function toRgbValues(color: string | undefined): string {
  if (!color) return "0 0 0";

  // Already in rgb/rgba format
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((p) => p.trim())
      .join(" ");
    return parts || "0 0 0";
  }

  // Hex format (#rgb or #rrggbb)
  if (color.startsWith("#")) {
    let hex = color.replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }

    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r} ${g} ${b}`;
    }
  }

  return "0 0 0";
}

// Key name for theme storage in localStorage
const THEME_STORAGE_KEY = "readlite_theme";

/**
 * Get the user's preferred theme
 * First tries to read from localStorage, returns default theme if not found
 */
export function getPreferredTheme(): ThemeType {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
      const normalized = normalizeTheme(savedTheme);
      if (normalized !== savedTheme) {
        // migrate legacy value silently
        localStorage.setItem(THEME_STORAGE_KEY, normalized);
      }
      return normalized;
    }
  } catch (e) {
    logger.warn("Unable to read theme settings from localStorage", e);
  }
  return "ink"; // Default to Paper Mono
}

/**
 * Save theme to local storage
 */
export function saveTheme(theme: ThemeType): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    // Trigger storage event so other windows or components can detect the change
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: THEME_STORAGE_KEY,
        newValue: theme,
        storageArea: localStorage,
      }),
    );
    logger.info(`Theme saved: ${theme}`);
  } catch (e) {
    logger.error("Unable to save theme settings", e);
  }
}

/**
 * Apply theme globally to the target root (ShadowRoot or Document or HTMLElement)
 */
export function applyThemeGlobally(
  theme: ThemeType,
  targetRoot?: Document | ShadowRoot | HTMLElement,
): void {
  // Use provided root or fallback to document (for main page context if needed)
  const root = targetRoot || document;
  
  // Determine the element to apply classes/styles to
  let rootElement: HTMLElement;
  if (root instanceof Document) {
      rootElement = root.documentElement;
  } else if (root instanceof ShadowRoot) {
      // ShadowRoot itself doesn't have classList/style. 
      // We can't apply classes to it directly. 
      // We'll try to use the host element if available, but for Shadow DOM styles,
      // it's often better to target a wrapper div inside. 
      // However, if the caller passed ShadowRoot, we'll try to find its host.
      // Note: ShadowRoot.host exists but TS might need casting in some envs.
      rootElement = root.host as HTMLElement;
  } else {
      rootElement = root as HTMLElement;
  }

  // Guard against invalid elements
  if (!rootElement || !rootElement.classList || !rootElement.style) {
      logger.warn("Invalid root element for theme application", root);
      return;
  }

  const normalizedTheme = normalizeTheme(theme);
  logger.info(`Applying theme globally: ${normalizedTheme}`);

  const themeColors = themeTokens[normalizedTheme];

  // --- 2. Apply CSS Variables ---
  // Apply to the root element (host or html)
  applyCSSVariables(rootElement.style, themeColors);

  // --- 3. Apply Theme Classes/Attributes ---
  // Clean up previous themes
  AVAILABLE_THEMES.forEach((t) => {
    rootElement.classList.remove(t);
    // Also remove from body if we are in a Document
    if (root instanceof Document) {
      root.body.classList.remove(t);
    }
  });

  rootElement.classList.add(normalizedTheme);
  rootElement.setAttribute("data-theme", normalizedTheme);

  // Apply transition
  rootElement.classList.add("theme-transition");
  setTimeout(() => {
    rootElement.classList.remove("theme-transition");
  }, 300);
}

/**
 * Apply all CSS variables to a style declaration
 */
function applyCSSVariables(style: CSSStyleDeclaration, colors: any): void {
  try {
    // Background color series
    style.setProperty("--readlite-bg-primary", colors.bg.primary);
    style.setProperty(
      "--readlite-bg-primary-rgb",
      toRgbValues(colors.bg.primary),
    );
    style.setProperty("--readlite-bg-secondary", colors.bg.secondary);
    style.setProperty(
      "--readlite-bg-secondary-rgb",
      toRgbValues(colors.bg.secondary),
    );
    style.setProperty("--readlite-bg-tertiary", colors.bg.tertiary);
    style.setProperty(
      "--readlite-bg-tertiary-rgb",
      toRgbValues(colors.bg.tertiary),
    );
    style.setProperty("--readlite-bg-user", colors.bg.user);
    style.setProperty("--readlite-bg-input", colors.bg.input);

    // Readlite prefixed variables (for backward compatibility)
    style.setProperty("--readlite-background", colors.bg.primary);
    style.setProperty("--readlite-message-bg", colors.bg.secondary);
    style.setProperty("--readlite-user-bubble", colors.bg.user);
    style.setProperty("--readlite-input-bg", colors.bg.input);

    // Text color series
    style.setProperty("--readlite-text-primary", colors.text.primary);
    style.setProperty(
      "--readlite-text-primary-rgb",
      toRgbValues(colors.text.primary),
    );
    style.setProperty("--readlite-text-secondary", colors.text.secondary);
    style.setProperty(
      "--readlite-text-secondary-rgb",
      toRgbValues(colors.text.secondary),
    );
    style.setProperty("--readlite-text-user", colors.text.user);
    style.setProperty("--readlite-text-accent", colors.text.accent);

    // Readlite prefixed text variables
    style.setProperty("--readlite-text", colors.text.primary);
    style.setProperty("--readlite-text-user", colors.text.user);
    style.setProperty("--readlite-text-secondary", colors.text.secondary);

    // Border and accent colors
    style.setProperty("--readlite-border", colors.ui.border);
    style.setProperty(
      "--readlite-border-rgb",
      toRgbValues(colors.ui.border),
    );
    style.setProperty("--readlite-accent", colors.ui.accent);
    style.setProperty(
      "--readlite-accent-rgb",
      toRgbValues(colors.ui.accent),
    );
    style.setProperty("--readlite-error", colors.ui.error);
    style.setProperty("--readlite-error-rgb", toRgbValues(colors.ui.error));

    // Highlight colors
    if (colors.highlight) {
      style.setProperty("--readlite-highlight-beige", colors.highlight.beige);
      style.setProperty("--readlite-highlight-cyan", colors.highlight.cyan);
      style.setProperty(
        "--readlite-highlight-lavender",
        colors.highlight.lavender,
      );
      style.setProperty("--readlite-highlight-olive", colors.highlight.olive);
      style.setProperty("--readlite-highlight-peach", colors.highlight.peach);
      style.setProperty(
        "--readlite-highlight-selection",
        colors.highlight.selection,
      );
      style.setProperty(
        "--readlite-highlight-selection-hover",
        colors.highlight.selectionHover,
      );
    }

    // Link colors
    if (colors.link) {
      style.setProperty("--readlite-link", colors.link.normal);
      style.setProperty("--readlite-link-hover", colors.link.hover);
    }
  } catch (e) {
    logger.error("Error applying CSS variables:", e);
  }
}

/**
 * Generate theme style tag content
 */
export function generateThemeStyleContent(theme: ThemeType): string {
  return `
    /* Basic theme class */
    html.${theme}, body.${theme} {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    
    /* Container elements */
    html.${theme} .readlite-reader-container, 
    body.${theme} .readlite-reader-container,
    html.${theme} #readlite-root,
    body.${theme} #readlite-root {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
    }
    
    /* Link styles */
    html.${theme} a,
    body.${theme} a {
      color: var(--readlite-link) !important;
    }
    
    html.${theme} a:hover,
    body.${theme} a:hover {
      color: var(--readlite-link-hover) !important;
    }
    
    /* Scrollbar styles */
    html.${theme} ::-webkit-scrollbar,
    body.${theme} ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    
    html.${theme} ::-webkit-scrollbar-track,
    body.${theme} ::-webkit-scrollbar-track {
      background: var(--readlite-scrollbar-track);
    }
    
    html.${theme} ::-webkit-scrollbar-thumb,
    body.${theme} ::-webkit-scrollbar-thumb {
      background: var(--readlite-scrollbar-thumb);
      border-radius: 4px;
    }
    
    /* Ensure elements controlled by CSS variables apply styles correctly */
    .readlite-reader-content, .readlite-reader-container {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
    }
  `;
}

/**
 * Apply theme styles to a root node (Document or ShadowRoot)
 */
export function applyThemeStyles(root: Document | ShadowRoot, theme: ThemeType): void {
  const normalizedTheme = normalizeTheme(theme);
  const styleContent = generateThemeStyleContent(normalizedTheme);
  const styleId = "readlite-theme-dynamic-styles";

  // Check if style tag already exists
  let styleElement = (root instanceof Document || root instanceof ShadowRoot) 
    ? root.getElementById(styleId) as HTMLStyleElement 
    : null;

  if (!styleElement) {
    // Create new style tag
    // Use ownerDocument or document to create element
    const doc = (root instanceof Document) ? root : (root.ownerDocument || document);
    styleElement = doc.createElement("style");
    styleElement.id = styleId;
    
    // Append to head (if Document) or root (if ShadowRoot)
    if (root instanceof Document) {
        root.head.appendChild(styleElement);
    } else {
        root.appendChild(styleElement);
    }
  }

  // Update style content
  styleElement.textContent = styleContent;
}

/**
 * Listen for theme changes and automatically apply
 */
export function setupThemeChangeListener(
  root: Document | ShadowRoot | HTMLElement,
  callback?: (theme: ThemeType) => void,
): () => void {
  const storageListener = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && event.newValue) {
      const newTheme = event.newValue as ThemeType;
      if (AVAILABLE_THEMES.includes(newTheme as ThemeType)) {
        applyThemeGlobally(newTheme, root);
        if (root instanceof Document || root instanceof ShadowRoot) {
           applyThemeStyles(root, newTheme);
        }

        if (callback) {
          callback(newTheme);
        }
      }
    }
  };

  window.addEventListener("storage", storageListener);

  // Return cleanup function
  return () => window.removeEventListener("storage", storageListener);
}
