/**
 * Reader State Manager
 * Centralized state management for reader mode
 */

import { createLogger } from '../utils/logger';
import { Article, Settings } from '../types';
import { ThemeType } from '../config/theme';

const logger = createLogger('reader-state');

export interface ReaderState {
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  article: Article | null;
  settings: Settings;
  showSettings: boolean;
  showAgent: boolean;
  isFullscreen: boolean;
  leftPanelWidth: number;
}

// Default state values
const defaultState: ReaderState = {
  isActive: false,
  isLoading: false,
  error: null,
  article: null,
  settings: {
    theme: 'light',
    fontFamily: '',
    fontSize: 18,
    lineHeight: 1.6,
    width: 700,
    spacing: 'normal',
    textAlign: 'left'
  },
  showSettings: false,
  showAgent: false,
  isFullscreen: false,
  leftPanelWidth: 65
};

// State change listeners
type StateListener = (state: ReaderState) => void;

class ReaderStateManager {
  private state: ReaderState = { ...defaultState };
  private listeners: Set<StateListener> = new Set();

  /**
   * Get current state
   */
  getState(): ReaderState {
    return { ...this.state };
  }

  /**
   * Update state partially
   */
  setState(updates: Partial<ReaderState>): void {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    logger.info('State updated:', {
      changed: Object.keys(updates),
      isActive: this.state.isActive
    });
    
    this.notifyListeners();
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<Settings>): void {
    this.setState({
      settings: { ...this.state.settings, ...settings }
    });
  }

  /**
   * Set article data
   */
  setArticle(article: Article | null): void {
    this.setState({ article, isLoading: false, error: null });
  }

  /**
   * Set loading state
   */
  setLoading(isLoading: boolean): void {
    this.setState({ isLoading });
  }

  /**
   * Set error state
   */
  setError(error: string | null): void {
    this.setState({ error, isLoading: false });
  }

  /**
   * Toggle reader mode
   */
  toggleReaderMode(): void {
    this.setState({ isActive: !this.state.isActive });
    
    // Notify Chrome runtime about state change
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'READER_MODE_CHANGED',
        isActive: this.state.isActive
      }).catch(error => {
        logger.warn('Failed to send reader mode change message:', error);
      });
    }
  }

  /**
   * Toggle settings panel
   */
  toggleSettings(): void {
    this.setState({ showSettings: !this.state.showSettings });
  }

  /**
   * Toggle agent panel
   */
  toggleAgent(): void {
    this.setState({ showAgent: !this.state.showAgent });
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    this.setState({ isFullscreen: !this.state.isFullscreen });
  }

  /**
   * Set left panel width (for reader/agent split)
   */
  setLeftPanelWidth(width: number): void {
    // Clamp between 30% and 85%
    const clampedWidth = Math.max(30, Math.min(85, width));
    this.setState({ leftPanelWidth: clampedWidth });
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.state = { ...defaultState };
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        logger.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Save current settings to storage
   */
  async saveSettings(): Promise<void> {
    try {
      await chrome.storage.sync.set({
        readerSettings: this.state.settings
      });
      logger.info('Settings saved to storage');
    } catch (error) {
      logger.error('Failed to save settings:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('readerSettings');
      if (result.readerSettings) {
        this.updateSettings(result.readerSettings);
        logger.info('Settings loaded from storage');
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
    }
  }
}

// Export singleton instance
export const readerState = new ReaderStateManager();