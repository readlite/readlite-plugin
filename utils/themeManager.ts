/**
 * Theme Manager - Manages all theme-related functionality
 * Responsible for theme loading, saving, and application
 */

import { ThemeType, AVAILABLE_THEMES, themeTokens } from "../config/theme";
import { createLogger } from "./logger";

const logger = createLogger("theme-manager");

// Key name for theme storage in localStorage
const THEME_STORAGE_KEY = "readlite_theme";

/**
 * Get the user's preferred theme
 * First tries to read from localStorage, returns default theme if not found
 */
export function getPreferredTheme(): ThemeType {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && AVAILABLE_THEMES.includes(savedTheme as ThemeType)) {
      return savedTheme as ThemeType;
    }
  } catch (e) {
    logger.warn("Unable to read theme settings from localStorage", e);
  }
  return "light"; // Default to light theme
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
  customTheme?: string,
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

  logger.info(
    `Applying theme globally: ${theme}${customTheme ? " (custom)" : ""}`,
  );

  let themeColors = themeTokens[theme];

  // --- 1. Process Custom Theme ---
  if (theme === "custom") {
    // If customTheme wasn't provided, try to load from localStorage
    if (!customTheme) {
      try {
        const savedCustomTheme = localStorage.getItem("readlite-custom-theme");
        if (savedCustomTheme) {
          customTheme = savedCustomTheme;
        }
      } catch (e) {
        logger.error("Failed to load custom theme from localStorage", e);
      }
    }

    // Now apply the custom theme if available
    if (customTheme) {
      try {
        const customThemeObj = JSON.parse(customTheme);
        // Merge custom colors with base theme tokens
        themeColors = {
          ...themeTokens.custom, // Start with custom defaults
          bg: {
            ...themeTokens.custom.bg,
            ...(customThemeObj.bgPrimary && {
              primary: customThemeObj.bgPrimary,
              secondary: customThemeObj.bgPrimary, 
              tertiary: customThemeObj.bgPrimary,
              user: customThemeObj.bgPrimary,
              input: customThemeObj.bgPrimary,
            }),
          },
          text: {
            ...themeTokens.custom.text,
            ...(customThemeObj.textPrimary && {
              primary: customThemeObj.textPrimary,
              secondary: customThemeObj.textPrimary,
              user: customThemeObj.textPrimary,
            }),
          },
          ...(customThemeObj.accent && {
            accent: customThemeObj.accent,
          }),
          ...(customThemeObj.border && { border: customThemeObj.border }),
        };

        if (customThemeObj.accent) {
          themeColors.text = {
            ...themeColors.text,
            accent: customThemeObj.accent,
          };
        }
      } catch (e) {
        logger.error("Failed to parse or apply custom theme", e);
        themeColors = themeTokens.custom;
      }
    }
  }

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

  rootElement.classList.add(theme);
  rootElement.setAttribute("data-theme", theme);

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
    style.setProperty("--readlite-bg-secondary", colors.bg.secondary);
    style.setProperty("--readlite-bg-tertiary", colors.bg.tertiary);
    style.setProperty("--readlite-bg-user", colors.bg.user);
    style.setProperty("--readlite-bg-input", colors.bg.input);

    // Readlite prefixed variables (for backward compatibility)
    style.setProperty("--readlite-background", colors.bg.primary);
    style.setProperty("--readlite-message-bg", colors.bg.secondary);
    style.setProperty("--readlite-user-bubble", colors.bg.user);
    style.setProperty("--readlite-input-bg", colors.bg.input);

    // Text color series
    style.setProperty("--readlite-text-primary", colors.text.primary);
    style.setProperty("--readlite-text-secondary", colors.text.secondary);
    style.setProperty("--readlite-text-user", colors.text.user);
    style.setProperty("--readlite-text-accent", colors.text.accent);

    // Readlite prefixed text variables
    style.setProperty("--readlite-text", colors.text.primary);
    style.setProperty("--readlite-text-user", colors.text.user);
    style.setProperty("--readlite-text-secondary", colors.text.secondary);

    // Border and accent colors
    style.setProperty("--readlite-border", colors.ui.border);
    style.setProperty("--readlite-accent", colors.ui.accent);
    style.setProperty("--readlite-error", colors.ui.error);

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
  const styleContent = generateThemeStyleContent(theme);
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
