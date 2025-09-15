import { createLogger } from "./logger";

// Create a logger for this module
const logger = createLogger("auth");

/**
 * Authentication utilities for ReadLite
 * Handles token management, authentication status, and login functionality
 */

// Token storage keys
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TIMESTAMP_KEY = "auth_timestamp";
const TOKEN_EXPIRY_DAYS = 30; // Token expires after 30 days

/**
 * Check if user is authenticated with a valid token
 * @returns Promise resolving to authentication status
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const token = await getAuthToken();
    const timestamp = await getAuthTimestamp();

    // If no token, not authenticated
    if (!token) return false;

    // Check if token has expired
    if (timestamp) {
      const expiryTime = timestamp + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > expiryTime) {
        // Token expired, clear it
        await clearAuthData();
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error("[Auth] Error checking authentication status:", error);
    return false;
  }
}

/**
 * Get the stored authentication token
 * @returns Promise resolving to the token or null if not available
 */
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_TOKEN_KEY], (result) => {
      resolve(result[AUTH_TOKEN_KEY] || null);
    });
  });
}

/**
 * Get the timestamp when the token was stored
 * @returns Promise resolving to the timestamp or null if not available
 */
export async function getAuthTimestamp(): Promise<number | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([AUTH_TIMESTAMP_KEY], (result) => {
      resolve(result[AUTH_TIMESTAMP_KEY] || null);
    });
  });
}

/**
 * Clear all authentication data
 * @returns Promise resolving when data is cleared
 */
export async function clearAuthData(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([AUTH_TOKEN_KEY, AUTH_TIMESTAMP_KEY], () => {
      // Notify about authentication status change
      chrome.runtime.sendMessage({
        type: "AUTH_STATUS_CHANGED",
        isAuthenticated: false,
      });
      resolve();
    });
  });
}

/**
 * Handle token expiry or authorization errors
 * @param error The error object or response
 * @returns Promise<boolean> indicating whether token expiry was handled
 */
export async function handleTokenExpiry(error: any): Promise<boolean> {
  // Check various error conditions that indicate auth problems
  const isAuthError =
    (error && error.status === 401) ||
    (error &&
      typeof error.message === "string" &&
      (error.message.includes("401") ||
        error.message.toLowerCase().includes("unauthorized") ||
        error.message.toLowerCase().includes("unauthenticated")));

  if (isAuthError) {
    logger.warn(
      "[Auth] Authentication error detected:",
      error.status || error.message,
    );

    // Clear existing token data (which will notify about auth change)
    await clearAuthData();
    return true;
  }

  return false;
}

/**
 * Open the authentication page in a new tab
 * Uses the browser's language to determine which locale to use
 * Works in both content script and background script contexts
 */
export function openAuthPage(): void {
  // Determine correct locale
  const locale = determineUserLocale();
  const authUrl = `https://readlite.app/${locale}/auth/sync`;

  // Check if we're in a background script context (no window)
  if (typeof window === "undefined") {
    // Use chrome.tabs API for background scripts
    chrome.tabs.create({ url: authUrl });
  } else {
    // Use window.open for content scripts
    window.open(authUrl, "_blank");
  }
}

/**
 * Get user's locale based on browser language
 * @returns 'zh' for Chinese users, 'en' for everyone else
 */
function determineUserLocale(): string {
  try {
    // Try using chrome.i18n API if available
    if (
      typeof chrome !== "undefined" &&
      chrome.i18n &&
      chrome.i18n.getUILanguage
    ) {
      const browserLang = chrome.i18n.getUILanguage();
      return browserLang.startsWith("zh") ? "zh" : "en";
    }
    // Fallback to navigator.language which is available in content scripts
    else {
      const browserLang =
        navigator.language || navigator.languages?.[0] || "en";
      return browserLang.startsWith("zh") ? "zh" : "en";
    }
  } catch (error) {
    logger.error("[Auth] Error determining user locale:", error);
    return "en"; // Default to English on error
  }
}

/**
 * Set up listener for auth messages from the web app
 * Should be called once during extension initialization
 */
export function setupAuthListener(): void {
  // Check if we're in a content script context
  if (typeof window !== "undefined") {
    window.addEventListener("message", function (event) {
      // Security check for message origin
      if (event.origin !== "https://readlite.app") return;

      // Process auth token message
      if (event.data && event.data.type === "READLITE_AUTH_TOKEN") {
        const token = event.data.token;

        // Save token to extension storage
        chrome.storage.local.set(
          {
            [AUTH_TOKEN_KEY]: token,
            [AUTH_TIMESTAMP_KEY]: Date.now(),
          },
          function () {
            logger.info("[Auth] Token saved to extension storage");

            // Send confirmation message back to web app
            window.postMessage(
              {
                type: "READLITE_AUTH_TOKEN_RECEIVED",
                success: true,
              },
              "*",
            );

            // Notify background script about auth status change
            chrome.runtime.sendMessage({
              type: "AUTH_STATUS_CHANGED",
              isAuthenticated: true,
            });
          },
        );
      }
    });
  }
}
