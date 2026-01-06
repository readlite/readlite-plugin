/**
 * Theme Manager - Manages all theme-related functionality
 * Responsible for theme loading, saving, and application
 */

import { ThemeType, AVAILABLE_THEMES, themeTokens, ThemeColors } from "../config/theme";
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
    // Trigger storage event so other windows or iframes can detect the change
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
 * Get the document or shadow root for theme application
 * This should be used internally to ensure consistent document targeting
 */
function getTargetContext(): Document | ShadowRoot {
  // 1. Try to find the shadow root host
  const container = document.getElementById("readlite-container");
  if (container && container.shadowRoot) {
    logger.info("Using Shadow DOM for theme application");
    return container.shadowRoot;
  }

  // 2. Fallback to main document with warning
  logger.warn("Shadow Root not found, using main document for theme application");
  return document;
}

/**
 * Apply theme globally to the main document, shadow DOM, and iframes
 */
export function applyThemeGlobally(
  theme: ThemeType,
  customTheme?: string,
  doc?: Document | ShadowRoot,
  rootElement?: HTMLElement,
): void {
  // Always get the target context internally, or use the provided one
  const targetContext = doc || getTargetContext();

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
          logger.info(
            `Loading saved custom theme from localStorage: ${savedCustomTheme}`,
          );
          customTheme = savedCustomTheme;
        } else {
          logger.warn("No saved custom theme found in localStorage");
        }
      } catch (e) {
        logger.error("Failed to load custom theme from localStorage", e);
      }
    }

    // Now apply the custom theme if available
    if (customTheme) {
      try {
        const customThemeObj = JSON.parse(customTheme);
        logger.info(
          `Custom theme parsed: ${JSON.stringify(customThemeObj, null, 2)}`,
        );

        // Merge custom colors with base theme tokens
        themeColors = {
          ...themeTokens.custom, // Start with custom defaults
          bg: {
            ...themeTokens.custom.bg,
            ...(customThemeObj.bgPrimary && {
              primary: customThemeObj.bgPrimary,
              secondary: customThemeObj.bgPrimary, // Assuming secondary backgrounds match primary for simplicity
              tertiary: customThemeObj.bgPrimary,
              user: customThemeObj.bgPrimary,
              input: customThemeObj.bgPrimary,
            }),
          },
          text: {
            ...themeTokens.custom.text,
            ...(customThemeObj.textPrimary && {
              primary: customThemeObj.textPrimary,
              secondary: customThemeObj.textPrimary, // Assuming secondary text matches primary
              user: customThemeObj.textPrimary,
            }),
          },
          ...(customThemeObj.accent && {
            accent: customThemeObj.accent,
          }),
          ...(customThemeObj.border && { border: customThemeObj.border }),
        };

        // 确保自定义文本重音色也正确应用
        if (customThemeObj.accent) {
          themeColors.text = {
            ...themeColors.text,
            accent: customThemeObj.accent,
          };
        }

        logger.info(`Applied custom theme colors. Final colors:`, themeColors);
      } catch (e) {
        logger.error("Failed to parse or apply custom theme", e);
        logger.error(`Custom theme string was: ${customTheme}`);
        // Fallback to default custom theme if parsing fails
        themeColors = themeTokens.custom;
      }
    }
  }

  // --- Helper function to apply theme attributes and variables ---
  const applyToElement = (
    element: HTMLElement,
    colors: ThemeColors,
    isRootContainer: boolean = false,
  ) => {
    // Remove previous theme classes
    AVAILABLE_THEMES.forEach((t) => element.classList.remove(t));
    // Add current theme class
    element.classList.add(theme);
    // Set data-theme attribute
    element.setAttribute("data-theme", theme);
    // Apply direct background/color for the main container for robustness
    if (isRootContainer) {
      element.style.backgroundColor = colors.bg.primary;
      element.style.color = colors.text.primary;
    }
  };

  // --- 2. Apply CSS Variables Globally (within the iframe) ---
  // CSS Variables need to be on :root (documentElement) for Tailwind etc. to work reliably
  // For Shadow DOM, we apply to the host or wrapper
  if (targetContext instanceof Document) {
    applyCSSVariables(targetContext.documentElement.style, themeColors);
    targetContext.documentElement.classList.add("theme-transition");
  } else {
    // ShadowRoot
    const wrapper = targetContext.querySelector('.readlite-theme-wrapper') as HTMLElement;
    if (wrapper) {
      applyCSSVariables(wrapper.style, themeColors);
    }
    // Also apply to host for inheritance
    if (targetContext.host instanceof HTMLElement) {
       applyCSSVariables(targetContext.host.style, themeColors);
    }
  }

  // --- 3. Apply Theme Attributes/Classes to the main App Container ---
  const readerRootElement = rootElement || targetContext.getElementById("readlite-root");
  if (readerRootElement) {
    // Apply theme class, data-attribute, and direct styles ONLY to the root container
    applyToElement(readerRootElement, themeColors, true);
  } else {
    logger.warn(
      "#readlite-root element not found in the document for theme application.",
    );
  }

  // --- 4. Apply necessary classes/attributes to html/body ---
  if (targetContext instanceof Document) {
    AVAILABLE_THEMES.forEach((t) => {
      targetContext.documentElement.classList.remove(t);
      targetContext.body.classList.remove(t);
    });

    // Remove transition class after a delay
    setTimeout(() => {
      targetContext.documentElement.classList.remove("theme-transition");
    }, 300); // Match CSS transition duration
  } else {
     // For Shadow DOM, update wrapper classes
     const wrapper = targetContext.querySelector('.readlite-theme-wrapper');
     if (wrapper) {
        AVAILABLE_THEMES.forEach((t) => wrapper.classList.remove(t));
        wrapper.classList.add(theme);
     }
  }
}

/**
 * Apply all CSS variables to a style declaration
 */
function applyCSSVariables(style: CSSStyleDeclaration, colors: ThemeColors): void {
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
 * Updated to support both global context (iframe/main) and Shadow DOM
 */
export function generateThemeStyleContent(theme: ThemeType): string {
  return `
    /* Basic theme class - Global Context */
    html.${theme}, body.${theme} {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    /* Shadow DOM Host */
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2147483645;
      visibility: visible; /* Ensure host is visible */
    }

    /* Shadow DOM Wrapper */
    .readlite-theme-wrapper.${theme} {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      transition: background-color 0.3s ease, color 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 16px;
      line-height: 1.5;
    }
    
    /* Container elements */
    html.${theme} .readlite-reader-container, 
    body.${theme} .readlite-reader-container,
    html.${theme} #readlite-root,
    body.${theme} #readlite-root,
    .readlite-theme-wrapper.${theme} #readlite-root {
      background-color: var(--readlite-bg-primary) !important;
      color: var(--readlite-text-primary) !important;
    }
    
    /* Link styles */
    html.${theme} a,
    body.${theme} a,
    .readlite-theme-wrapper.${theme} a {
      color: var(--readlite-link) !important;
    }
    
    html.${theme} a:hover,
    body.${theme} a:hover,
    .readlite-theme-wrapper.${theme} a:hover {
      color: var(--readlite-link-hover) !important;
    }
    
    /* Scrollbar styles */
    html.${theme} ::-webkit-scrollbar,
    body.${theme} ::-webkit-scrollbar,
    .readlite-theme-wrapper.${theme}::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    
    html.${theme} ::-webkit-scrollbar-track,
    body.${theme} ::-webkit-scrollbar-track,
    .readlite-theme-wrapper.${theme}::-webkit-scrollbar-track {
      background: var(--readlite-scrollbar-track);
    }
    
    html.${theme} ::-webkit-scrollbar-thumb,
    body.${theme} ::-webkit-scrollbar-thumb,
    .readlite-theme-wrapper.${theme}::-webkit-scrollbar-thumb {
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
 * Apply theme styles to Document or ShadowRoot
 */
export function applyThemeStyles(target: Document | ShadowRoot, theme: ThemeType): void {
  const styleContent = generateThemeStyleContent(theme);
  const styleId = "readlite-theme-dynamic-styles";

  // Check if style tag already exists
  let styleElement = target.getElementById(styleId) as HTMLStyleElement;

  if (!styleElement) {
    // Create new style tag
    styleElement = document.createElement("style");
    styleElement.id = styleId;
    
    if (target instanceof Document) {
      target.head.appendChild(styleElement);
    } else {
      // For ShadowRoot, append to the root itself
      target.appendChild(styleElement);
    }
  }

  // Update style content
  styleElement.textContent = styleContent;
}

/**
 * Listen for theme changes and automatically apply
 */
export function setupThemeChangeListener(
  doc: Document,
  callback?: (theme: ThemeType) => void,
): () => void {
  const storageListener = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY && event.newValue) {
      const newTheme = event.newValue as ThemeType;
      if (AVAILABLE_THEMES.includes(newTheme as ThemeType)) {
        applyThemeGlobally(newTheme, undefined, doc);
        applyThemeStyles(doc, newTheme);

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
