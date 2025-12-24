import { useState, useEffect, useCallback } from 'react';
import { isAuthenticated } from '../../../services/auth';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('useAgentAuth');

export const useAgentAuth = () => {
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check initial authentication status
  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        logger.info('Checking initial authentication status');
        const authStatus = await isAuthenticated();
        logger.info('Initial auth status:', authStatus);
        setIsAuth(authStatus);
      } catch (error) {
        logger.error('Error checking authentication:', error);
        setIsAuth(false);
      } finally {
        setIsAuthLoading(false);
      }
    };
    
    checkInitialAuth();
  }, []);

  // Monitor for authentication status changes via runtime messages
  useEffect(() => {
    const authChangeListener = (message: any) => {
      if (message.type === 'AUTH_STATUS_CHANGED' && message.isAuthenticated !== undefined) {
        logger.info('Authentication status changed:', message.isAuthenticated);
        setIsAuth(message.isAuthenticated);
        setIsAuthLoading(false);
      }
    };
    
    chrome.runtime.onMessage.addListener(authChangeListener);
    return () => {
      chrome.runtime.onMessage.removeListener(authChangeListener);
    };
  }, []);

  const login = useCallback(() => {
    setAuthError(null);
    setIsAuthLoading(true);
    logger.info('Starting authentication flow');

    const sendMessageWithRetry = (attempt: number) => {
      chrome.runtime.sendMessage({ type: 'LOGIN_WITH_GOOGLE' }, (response) => {
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message;
          logger.warn(`Login message error (attempt ${attempt}):`, errorMessage);

          if (attempt < 3 && errorMessage && errorMessage.includes('Receiving end does not exist')) {
            const delay = 500 * attempt;
            setTimeout(() => sendMessageWithRetry(attempt + 1), delay);
            return;
          }

          logger.error('Login message failed after retries:', errorMessage);
          setAuthError('Failed to communicate with extension background. Please try again.');
          setIsAuthLoading(false);
          return;
        }

        if (response && response.success) {
          logger.info('Login successful via background');
          // Auth status change will be handled by the message listener
          // Fallback check
          setTimeout(async () => {
            const status = await isAuthenticated();
            if (status) {
              setIsAuth(true);
              setIsAuthLoading(false);
            } else {
              setIsAuthLoading(false);
            }
          }, 500);
        } else {
          logger.error('Login failed:', response?.error);
          setAuthError(response?.error || 'Login failed. Please try again.');
          setIsAuthLoading(false);
        }
      });
    };

    sendMessageWithRetry(1);
  }, []);

  return {
    isAuth,
    setIsAuth, // Exposed in case we need manual update (e.g. on 401)
    isAuthLoading,
    authError,
    setAuthError,
    login
  };
};
