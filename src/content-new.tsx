/**
 * ReadLite Content Script
 * Simplified version using modular services
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlasmoCSConfig } from 'plasmo';
import { AppProvider } from './context/AppContext';
import Reader from './components/core/Reader';
import { iframeManager } from './services/iframeManager';
import { readerState } from './services/readerStateManager';
import { setupAuthListener } from './utils/auth';
import { createLogger } from './utils/logger';
import { getPreferredTheme } from './utils/themeManager';
import type { ExtensionMessage } from './types';

const logger = createLogger('content');

// Content script configuration
export const config: PlasmoCSConfig = {
  matches: ['<all_urls>'],
  run_at: 'document_idle'
};

// Set isolated world for content script
// @ts-expect-error - Plasmo-specific configuration
export const world = 'ISOLATED';

/**
 * Main Content Script Component
 * Manages reader mode lifecycle and iframe rendering
 */
const ContentScript: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initialize();
    return cleanup;
  }, []);

  // Initialize content script
  const initialize = async () => {
    logger.info('Initializing content script');

    // Setup authentication listener
    try {
      setupAuthListener();
      logger.info('Auth listener setup complete');
    } catch (error) {
      logger.error('Failed to setup auth listener:', error);
    }

    // Inject global styles
    injectGlobalStyles();

    // Setup message listeners
    setupMessageListeners();

    // Setup event listeners
    setupEventListeners();

    // Notify background script that we're ready
    notifyBackgroundReady();

    // Load saved settings
    await readerState.loadSettings();

    setIsInitialized(true);
    logger.info('Content script initialized');
  };

  // Cleanup on unmount
  const cleanup = () => {
    logger.info('Cleaning up content script');
    
    // Destroy iframe
    iframeManager.destroy();
    
    // Remove global styles
    const styleElement = document.getElementById('readlite-global-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Reset page state
    document.documentElement.classList.remove('readlite-active');
    document.body.style.overflow = '';
    
    // Reset reader state
    readerState.reset();
  };

  // Inject global CSS styles
  const injectGlobalStyles = () => {
    const styleElement = document.createElement('style');
    styleElement.id = 'readlite-global-styles';
    styleElement.textContent = `
      html.readlite-active {
        overflow: hidden !important;
      }
      
      #readlite-iframe-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
        z-index: 2147483645;
        background-color: var(--readlite-bg-primary);
        display: none;
      }
    `;
    document.head.appendChild(styleElement);
  };

  // Setup message listeners for Chrome runtime
  const setupMessageListeners = () => {
    chrome.runtime.onMessage.addListener((
      message: ExtensionMessage,
      sender,
      sendResponse
    ) => {
      logger.info(`Received message: ${message.type}`);

      switch (message.type) {
        case 'ACTIVATE_READER':
          if (!readerState.getState().isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;

        case 'DEACTIVATE_READER':
          if (readerState.getState().isActive) {
            toggleReaderMode();
          }
          sendResponse({ success: true });
          break;

        case 'TOGGLE_READER':
          toggleReaderMode();
          sendResponse({ success: true });
          break;

        case 'AUTH_STATUS_CHANGED':
          // Handle auth status change if needed
          sendResponse({ received: true });
          break;
      }

      return false;
    });
  };

  // Setup DOM event listeners
  const setupEventListeners = () => {
    // Listen for internal toggle event from background script
    document.addEventListener('READLITE_TOGGLE_INTERNAL', () => {
      logger.info('Received internal toggle event');
      toggleReaderMode();
    });

    // Subscribe to reader state changes
    readerState.subscribe((state) => {
      if (state.isActive) {
        showReaderMode();
      } else {
        hideReaderMode();
      }
    });
  };

  // Notify background script that content script is ready
  const notifyBackgroundReady = () => {
    chrome.runtime.sendMessage({ 
      type: 'CONTENT_SCRIPT_READY' 
    }).catch(error => {
      logger.warn('Failed to notify background:', error);
    });
  };

  // Toggle reader mode
  const toggleReaderMode = () => {
    logger.info('Toggling reader mode');
    readerState.toggleReaderMode();
  };

  // Show reader mode
  const showReaderMode = () => {
    logger.info('Showing reader mode');

    // Create iframe if needed
    if (!iframeManager.isReady()) {
      const theme = getPreferredTheme();
      const iframe = iframeManager.create(theme);
      
      if (!iframe) {
        logger.error('Failed to create iframe');
        return;
      }

      // Render React app into iframe
      renderReaderInIframe();
    }

    // Show iframe
    iframeManager.show();
  };

  // Hide reader mode
  const hideReaderMode = () => {
    logger.info('Hiding reader mode');
    iframeManager.hide();
  };

  // Render Reader component into iframe
  const renderReaderInIframe = () => {
    const doc = iframeManager.getDocument();
    if (!doc) {
      logger.error('Cannot render: iframe document not available');
      return;
    }

    const rootElement = doc.getElementById('readlite-root');
    if (!rootElement) {
      logger.error('Cannot find root element in iframe');
      return;
    }

    try {
      const root = createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <AppProvider initialTheme={getPreferredTheme()}>
            <Reader />
          </AppProvider>
        </React.StrictMode>
      );
      
      iframeManager.setRoot(root);
      logger.info('Reader rendered successfully in iframe');
    } catch (error) {
      logger.error('Failed to render Reader:', error);
    }
  };

  // Component doesn't render anything directly
  return null;
};

// Custom Plasmo render function
export const render = async () => {
  logger.info('ReadLite content script starting');

  // Create hidden root for React
  const dummyRoot = document.createElement('div');
  dummyRoot.style.display = 'none';
  document.body.appendChild(dummyRoot);

  // Mount content script component
  const root = createRoot(dummyRoot);
  root.render(<ContentScript />);
};

// Plasmo root container (not used, but required)
export const getRootContainer = () => null;

export default ContentScript;