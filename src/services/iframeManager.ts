/**
 * IFrame Manager for ReadLite Extension
 * Handles creation, setup, and management of the isolated iframe for reader mode
 */

import { createLogger } from '../utils/logger';
import { ThemeType, AVAILABLE_THEMES, themeTokens } from '../config/theme';
import { applyThemeGlobally, applyThemeStyles, setupThemeChangeListener } from '../utils/themeManager';

const logger = createLogger('iframe-manager');

// Interface for iframe window with custom methods
interface IframeWindow extends Window {
  updateTheme?: (newTheme: string) => void;
}

// Iframe manager state
class IframeManager {
  private iframeElement: HTMLIFrameElement | null = null;
  private iframeRoot: any = null;
  private isInitialized = false;

  /**
   * Get the current iframe element
   */
  getIframe(): HTMLIFrameElement | null {
    return this.iframeElement;
  }

  /**
   * Get the iframe document
   */
  getDocument(): Document | null {
    return this.iframeElement?.contentDocument || null;
  }

  /**
   * Check if iframe exists and is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.iframeElement !== null && this.getDocument() !== null;
  }

  /**
   * Create and initialize the iframe
   */
  create(theme: ThemeType = 'light'): HTMLIFrameElement | null {
    // Check if iframe already exists
    if (document.getElementById('readlite-iframe-container')) {
      logger.info('Iframe already exists, reusing existing iframe');
      this.iframeElement = document.getElementById('readlite-iframe-container') as HTMLIFrameElement;
      return this.iframeElement;
    }

    // Create new iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'readlite-iframe-container';
    iframe.style.display = 'none'; // Initially hidden
    iframe.style.backgroundColor = themeTokens[theme].bg.primary;

    // Add to document
    document.body.appendChild(iframe);
    logger.info(`Created iframe container with theme: ${theme}`);

    // Verify iframe was added
    const iframeCheck = document.getElementById('readlite-iframe-container');
    if (!iframeCheck) {
      logger.error('Failed to append iframe to body');
      return null;
    }

    // Save reference
    this.iframeElement = iframe;
    
    // Setup iframe content
    this.setupContent(theme);
    
    return iframe;
  }

  /**
   * Setup iframe HTML structure and styles
   */
  private setupContent(theme: ThemeType): void {
    const doc = this.getDocument();
    if (!doc) {
      logger.error('Cannot setup iframe content: contentDocument is null');
      return;
    }

    // Write basic HTML structure
    doc.open();
    doc.write(this.getBaseHTML(theme));
    doc.close();

    // Apply theme
    applyThemeGlobally(theme);
    applyThemeStyles(doc, theme);

    // Setup theme update mechanism
    this.setupThemeHandling(doc, theme);

    // Add styles
    this.addStyles(doc);

    this.isInitialized = true;
    logger.info('Iframe content setup completed');
  }

  /**
   * Get base HTML template for iframe
   */
  private getBaseHTML(theme: ThemeType): string {
    return `
      <!DOCTYPE html>
      <html class="${theme}" data-theme="${theme}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ReadLite Reader</title>
          <style>
            /* Base reset styles */
            html, body {
              all: initial !important;
              display: block !important;
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif !important;
              font-size: 14px !important;
              line-height: 1.5 !important;
              transition: background-color 0.3s ease, color 0.3s ease !important;
            }
            
            #readlite-root {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
            }
          </style>
        </head>
        <body class="${theme}" data-theme="${theme}">
          <div id="readlite-root"></div>
        </body>
      </html>
    `;
  }

  /**
   * Setup theme handling for the iframe
   */
  private setupThemeHandling(doc: Document, initialTheme: ThemeType): void {
    if (!doc.defaultView) return;

    const iframeWindow = doc.defaultView as IframeWindow;

    // Add theme update method
    iframeWindow.updateTheme = (newTheme: string) => {
      if (AVAILABLE_THEMES.includes(newTheme as ThemeType)) {
        applyThemeGlobally(newTheme as ThemeType);
        applyThemeStyles(doc, newTheme as ThemeType);
        
        // Notify parent window
        try {
          window.parent.postMessage(
            { type: 'IFRAME_THEME_UPDATED', theme: newTheme },
            '*'
          );
        } catch (e) {
          logger.error('Failed to notify parent about theme update', e);
        }
      }
    };

    // Listen for theme change messages
    iframeWindow.addEventListener('message', (event) => {
      if (event.data?.type === 'THEME_CHANGE') {
        const theme = event.data.theme;
        if (AVAILABLE_THEMES.includes(theme as ThemeType)) {
          logger.info(`Received theme change message: ${theme}`);
          applyThemeGlobally(theme as ThemeType);
          applyThemeStyles(doc, theme as ThemeType);
        }
      }
    });

    // Setup storage listener for theme changes
    const cleanupListener = setupThemeChangeListener(doc, (newTheme) => {
      logger.info(`Theme changed via storage event: ${newTheme}`);
    });

    // Cleanup on unload
    iframeWindow.addEventListener('unload', cleanupListener);
  }

  /**
   * Add additional styles to iframe
   */
  private addStyles(doc: Document): void {
    // Add Tailwind CSS if available
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const tailwindLink = doc.createElement('link');
      tailwindLink.rel = 'stylesheet';
      tailwindLink.href = chrome.runtime.getURL('src/styles/tailwind.output.css');
      tailwindLink.onload = () => {
        logger.info('Tailwind CSS loaded successfully');
        this.addThemeFixes(doc);
      };
      doc.head.appendChild(tailwindLink);
    }
  }

  /**
   * Add theme-specific style fixes
   */
  private addThemeFixes(doc: Document): void {
    const fixesStyle = doc.createElement('style');
    fixesStyle.id = 'readlite-theme-fixes';
    fixesStyle.textContent = `
      /* Container styles */
      .readlite-reader-container {
        all: initial !important;
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background-color: inherit !important;
        color: inherit !important;
        z-index: 2147483645 !important;
        overflow: hidden !important;
        background-color: var(--readlite-bg-secondary) !important;
        color: var(--readlite-text-primary) !important;
        transition: background-color 0.3s ease, color 0.3s ease !important;
      }
      
      /* Tailwind utility classes */
      .mx-auto {
        margin-left: auto !important;
        margin-right: auto !important;
      }
    `;
    doc.head.appendChild(fixesStyle);
  }

  /**
   * Show the iframe
   */
  show(): void {
    if (!this.iframeElement) {
      logger.warn('Cannot show iframe: element does not exist');
      return;
    }
    
    this.iframeElement.style.display = 'block';
    
    // Disable original page scrolling
    document.documentElement.classList.add('readlite-active');
    document.body.style.overflow = 'hidden';
    
    logger.info('Iframe shown');
  }

  /**
   * Hide the iframe
   */
  hide(): void {
    if (!this.iframeElement) {
      logger.warn('Cannot hide iframe: element does not exist');
      return;
    }
    
    this.iframeElement.style.display = 'none';
    
    // Restore original page scrolling
    document.documentElement.classList.remove('readlite-active');
    document.body.style.overflow = '';
    
    logger.info('Iframe hidden');
  }

  /**
   * Update iframe theme
   */
  updateTheme(theme: ThemeType): void {
    if (!this.isReady()) {
      logger.warn('Cannot update theme: iframe not ready');
      return;
    }

    const doc = this.getDocument();
    if (!doc) return;

    // Apply theme to iframe
    applyThemeGlobally(theme);
    applyThemeStyles(doc, theme);

    // Post message to iframe
    try {
      if (this.iframeElement?.contentWindow) {
        this.iframeElement.contentWindow.postMessage(
          { type: 'THEME_CHANGE', theme },
          '*'
        );
      }
    } catch (error) {
      logger.error('Failed to post theme message to iframe', error);
    }

    // Dispatch event for app notification
    try {
      document.dispatchEvent(
        new CustomEvent('READLITE_THEME_CHANGED', {
          detail: { theme }
        })
      );
    } catch (error) {
      logger.error('Failed to dispatch theme changed event', error);
    }
  }

  /**
   * Set the React root for the iframe
   */
  setRoot(root: any): void {
    this.iframeRoot = root;
  }

  /**
   * Get the React root
   */
  getRoot(): any {
    return this.iframeRoot;
  }

  /**
   * Destroy the iframe and cleanup
   */
  destroy(): void {
    // Unmount React root if exists
    if (this.iframeRoot) {
      try {
        this.iframeRoot.unmount();
      } catch (error) {
        logger.error('Error unmounting React root:', error);
      }
      this.iframeRoot = null;
    }

    // Remove iframe element
    if (this.iframeElement?.parentNode) {
      this.iframeElement.parentNode.removeChild(this.iframeElement);
      logger.info('Removed iframe container');
    }

    this.iframeElement = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const iframeManager = new IframeManager();