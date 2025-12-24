import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger('auth');

/**
 * Authentication utilities for ReadLite
 * Handles token management, authentication status, and login functionality
 */

// Token storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_TIMESTAMP_KEY = 'auth_timestamp';
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
      const expiryTime = timestamp + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
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
        type: 'AUTH_STATUS_CHANGED',
        isAuthenticated: false
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
    (error && typeof error.message === 'string' && 
      (error.message.includes('401') || 
       error.message.toLowerCase().includes('unauthorized') ||
       error.message.toLowerCase().includes('unauthenticated')));
  
  if (isAuthError) {
    logger.warn("[Auth] Authentication error detected:", error.status || error.message);
    
    // Clear existing token data (which will notify about auth change)
    await clearAuthData();
    return true;
  }
  
  return false;
}

/**
 * Login with Google using chrome.identity API
 * Exchanges Google authorization code for ReadLite application token
 * @returns Promise resolving to the ReadLite app token
 */
export async function loginWithGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const redirectUri = chrome.identity.getRedirectURL();
      const clientId = "403776294910-84s0v4sun2bl8qljth5b59lrgl80dn0l.apps.googleusercontent.com";
      const scopes = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
      ];

      // Log the redirect URI so the user can add it to Google Cloud Console
      logger.info('[Auth] Using redirect URI:', redirectUri);
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      logger.info('[Auth] Full Auth URL:', authUrl.toString());

      logger.info('[Auth] Launching web auth flow...');

      chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true
      }, async (responseUrl) => {
        if (chrome.runtime.lastError) {
          logger.error('[Auth] Google login error:', JSON.stringify(chrome.runtime.lastError));
          reject(chrome.runtime.lastError);
          return;
        }

        if (responseUrl) {
          try {
            const url = new URL(responseUrl);
            const code = url.searchParams.get('code');
            
            if (!code) {
              throw new Error('No code received from Google');
            }

            // Exchange Google code for ReadLite app token
            logger.info('[Auth] Exchanging Google code for ReadLite token...');
            
            const response = await fetch('https://api.readlite.app/api/auth/google', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                code, 
                redirect_uri: redirectUri 
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.message || `Server error: ${response.status}`;
              throw new Error(errorMessage);
            }
            
            const data = await response.json();
            const appToken = data.token || data.access_token; // Handle potential response variations
            
            if (!appToken) {
              throw new Error('No token received from ReadLite server');
            }
            
            // Save ReadLite token to extension storage
            await new Promise<void>((saveResolve) => {
              chrome.storage.local.set({
                [AUTH_TOKEN_KEY]: appToken,
                [AUTH_TIMESTAMP_KEY]: Date.now()
              }, () => saveResolve());
            });

            logger.info('[Auth] ReadLite token saved to extension storage');
            
            // Notify background script about auth status change
            chrome.runtime.sendMessage({
              type: 'AUTH_STATUS_CHANGED',
              isAuthenticated: true
            });

            resolve(appToken);
          } catch (error) {
            logger.error('[Auth] Token exchange failed:', error);
            reject(error);
          }
        } else {
          reject(new Error('No response URL received from Google'));
        }
      });
    } catch (error) {
      logger.error('[Auth] Unexpected error during Google login:', error);
      reject(error);
    }
  });
}

/**
 * Set up listener for auth messages from the web app
 * Should be called once during extension initialization
 */
export function setupAuthListener(): void {
  // Check if we're in a content script context
  if (typeof window !== 'undefined') {
    window.addEventListener('message', function(event) {
      // Security check for message origin
      if (event.origin !== 'https://readlite.app') return;
      
      // Process auth token message
      if (event.data && event.data.type === 'READLITE_AUTH_TOKEN') {
        const token = event.data.token;
        
        // Save token to extension storage
        chrome.storage.local.set({
          [AUTH_TOKEN_KEY]: token,
          [AUTH_TIMESTAMP_KEY]: Date.now()
        }, function() {
          logger.info('[Auth] Token saved to extension storage');
          
          // Send confirmation message back to web app
          window.postMessage({
            type: 'READLITE_AUTH_TOKEN_RECEIVED',
            success: true
          }, '*');
          
          // Notify background script about auth status change
          chrome.runtime.sendMessage({
            type: 'AUTH_STATUS_CHANGED',
            isAuthenticated: true
          });
        });
      }
    });
  }
} 