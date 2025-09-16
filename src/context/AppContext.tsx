/**
 * Unified App Context Provider
 * Combines multiple contexts into a single provider for simpler component tree
 */

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './ThemeContext';
import { I18nProvider } from './I18nContext';
import { TranslationProvider } from './TranslationContext';
import { ReaderProvider } from './ReaderContext';
import { ThemeType } from '../config/theme';
import { Article, Settings } from '../types';
import { readerState, ReaderState } from '../services/readerStateManager';
import { createLogger } from '../utils/logger';

const logger = createLogger('app-context');

// Combined app state interface
export interface AppState extends ReaderState {
  // Add any additional app-wide state here
  isAuthenticated: boolean;
  locale: string;
}

// App context value interface
export interface AppContextValue {
  state: AppState;
  actions: {
    // Reader actions
    toggleReaderMode: () => void;
    toggleSettings: () => void;
    toggleAgent: () => void;
    toggleFullscreen: () => void;
    setLeftPanelWidth: (width: number) => void;
    updateSettings: (settings: Partial<Settings>) => void;
    setArticle: (article: Article | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    
    // App actions
    setAuthenticated: (authenticated: boolean) => void;
    setLocale: (locale: string) => void;
    closeReader: () => void;
    loadArticle: () => Promise<void>;
  };
}

// Create the context
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Custom hook to use the app context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

// Props for the provider
interface AppProviderProps {
  children: ReactNode;
  initialTheme?: ThemeType;
  initialLocale?: string;
}

/**
 * Unified App Provider Component
 * Wraps all necessary providers and manages global app state
 */
export const AppProvider: React.FC<AppProviderProps> = ({ 
  children, 
  initialTheme = 'light',
  initialLocale = 'en'
}) => {
  // Local state for app-specific values
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [locale, setLocale] = useState(initialLocale);
  
  // Reader state from the state manager
  const [readerStateValue, setReaderStateValue] = useState<ReaderState>(readerState.getState());

  // Subscribe to reader state changes
  useEffect(() => {
    const unsubscribe = readerState.subscribe((newState) => {
      setReaderStateValue(newState);
    });

    // Load initial settings
    readerState.loadSettings();

    return unsubscribe;
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Check if user is authenticated
  const checkAuthStatus = async () => {
    try {
      const token = await chrome.storage.local.get('auth_token');
      setIsAuthenticated(!!token.auth_token);
    } catch (error) {
      logger.error('Failed to check auth status:', error);
    }
  };

  // Close reader mode
  const closeReader = useCallback(() => {
    readerState.setState({ isActive: false });
    
    // Dispatch event to trigger UI close
    document.dispatchEvent(new CustomEvent('READLITE_TOGGLE_INTERNAL'));
  }, []);

  // Load article content
  const loadArticle = useCallback(async () => {
    readerState.setLoading(true);
    
    try {
      // This would be replaced with actual article extraction logic
      // For now, just simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set mock article data
      const mockArticle: Article = {
        title: 'Sample Article',
        content: '<p>Article content here...</p>',
        textContent: 'Article content here...'
      };
      
      readerState.setArticle(mockArticle);
    } catch (error) {
      logger.error('Failed to load article:', error);
      readerState.setError('Failed to load article content');
    }
  }, []);

  // Build the combined state
  const appState: AppState = {
    ...readerStateValue,
    isAuthenticated,
    locale
  };

  // Build the actions object
  const actions = {
    // Reader actions (delegated to state manager)
    toggleReaderMode: () => readerState.toggleReaderMode(),
    toggleSettings: () => readerState.toggleSettings(),
    toggleAgent: () => readerState.toggleAgent(),
    toggleFullscreen: () => readerState.toggleFullscreen(),
    setLeftPanelWidth: (width: number) => readerState.setLeftPanelWidth(width),
    updateSettings: (settings: Partial<Settings>) => readerState.updateSettings(settings),
    setArticle: (article: Article | null) => readerState.setArticle(article),
    setLoading: (loading: boolean) => readerState.setLoading(loading),
    setError: (error: string | null) => readerState.setError(error),
    
    // App actions
    setAuthenticated,
    setLocale,
    closeReader,
    loadArticle
  };

  // Context value
  const contextValue: AppContextValue = {
    state: appState,
    actions
  };

  // Wrap with all necessary providers
  return (
    <AppContext.Provider value={contextValue}>
      <ThemeProvider initialTheme={initialTheme}>
        <I18nProvider>
          <TranslationProvider>
            <ReaderProvider initialTheme={initialTheme}>
              {children}
            </ReaderProvider>
          </TranslationProvider>
        </I18nProvider>
      </ThemeProvider>
    </AppContext.Provider>
  );
};

// Export convenience hooks for specific state slices
export const useReaderState = () => {
  const { state } = useApp();
  return {
    article: state.article,
    settings: state.settings,
    isLoading: state.isLoading,
    error: state.error,
    isActive: state.isActive
  };
};

export const useReaderActions = () => {
  const { actions } = useApp();
  return {
    updateSettings: actions.updateSettings,
    setArticle: actions.setArticle,
    loadArticle: actions.loadArticle,
    closeReader: actions.closeReader
  };
};

export const useUIState = () => {
  const { state } = useApp();
  return {
    showSettings: state.showSettings,
    showAgent: state.showAgent,
    isFullscreen: state.isFullscreen,
    leftPanelWidth: state.leftPanelWidth
  };
};

export const useUIActions = () => {
  const { actions } = useApp();
  return {
    toggleSettings: actions.toggleSettings,
    toggleAgent: actions.toggleAgent,
    toggleFullscreen: actions.toggleFullscreen,
    setLeftPanelWidth: actions.setLeftPanelWidth
  };
};