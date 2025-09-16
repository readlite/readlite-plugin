/**
 * Reader Container Component
 * Main container for the reader mode UI
 */

import React, { useRef, useEffect } from 'react';
import { useApp, useUIState, useUIActions } from '../../context/AppContext';
import ReaderToolbar from './ReaderToolbar';
import ReaderContent from './ReaderContent';
import ReaderDivider from './ReaderDivider';
import ReadingProgress from './ReadingProgress';
import Settings from '../settings/Settings';
import { AgentUI } from '../agent/AgentUI';
import { createLogger } from '../../utils/logger';

const logger = createLogger('reader-container');

export const ReaderContainer: React.FC = () => {
  const { state, actions } = useApp();
  const uiState = useUIState();
  const uiActions = useUIActions();
  
  const readerContentRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Handle divider drag for resizing panels
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const containerWidth = window.innerWidth;
      const newLeftWidth = (e.clientX / containerWidth) * 100;
      
      // Clamp between 30% and 85%
      const clampedWidth = Math.max(30, Math.min(85, newLeftWidth));
      uiActions.setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === dividerRef.current) {
        isDraggingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    if (dividerRef.current) {
      dividerRef.current.addEventListener('mousedown', handleMouseDown);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (dividerRef.current) {
        dividerRef.current.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [uiActions]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to close reader
      if (e.key === 'Escape') {
        if (uiState.showSettings) {
          uiActions.toggleSettings();
        } else if (uiState.showAgent) {
          uiActions.toggleAgent();
        } else {
          actions.closeReader();
        }
      }

      // Cmd/Ctrl + , for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        uiActions.toggleSettings();
      }

      // Cmd/Ctrl + K for AI assistant
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        uiActions.toggleAgent();
      }

      // F11 for fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        uiActions.toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions, uiState, uiActions]);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-secondary">Loading article...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Failed to Load Article</h2>
          <p className="text-secondary mb-4">{state.error}</p>
          <button 
            onClick={actions.closeReader}
            className="px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover transition-colors"
          >
            Close Reader
          </button>
        </div>
      </div>
    );
  }

  // Main reader UI
  return (
    <div className={`reader-container flex flex-col h-screen bg-primary ${uiState.isFullscreen ? 'fullscreen' : ''}`}>
      {/* Reading progress bar */}
      <ReadingProgress scrollContainer={readerContentRef.current} />

      {/* Toolbar */}
      <ReaderToolbar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Reader content panel */}
        <div 
          className="reader-panel overflow-auto"
          style={{ width: uiState.showAgent ? `${uiState.leftPanelWidth}%` : '100%' }}
          ref={readerContentRef}
        >
          <ReaderContent
            settings={state.settings}
            article={state.article}
            detectedLanguage={state.article?.language || 'en'}
            error={state.error}
          />
        </div>

        {/* Divider (only show when agent is visible) */}
        {uiState.showAgent && (
          <>
            <ReaderDivider ref={dividerRef} />
            
            {/* Agent panel */}
            <div 
              className="agent-panel overflow-hidden bg-secondary"
              style={{ width: `${100 - uiState.leftPanelWidth}%` }}
            >
              <AgentUI />
            </div>
          </>
        )}
      </div>

      {/* Settings modal */}
      {uiState.showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-primary rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto m-4">
            <Settings />
          </div>
        </div>
      )}
    </div>
  );
};