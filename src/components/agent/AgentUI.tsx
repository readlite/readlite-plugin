import React, { useRef, useEffect, useCallback } from 'react';
import { useI18n } from '~/context/I18nContext';
import { marked } from 'marked';
import { ContextType } from '../../types/agent';
import { StyleIsolator } from '../../content';
import { useTheme } from '../../context/ThemeContext';
import { createLogger } from '../../utils/logger';
import LoginPrompt from './LoginPrompt';
import MessageList from './MessageList';
import InputArea from './InputArea';

import { useAgentAuth } from './hooks/useAgentAuth';
import { useAgentModels } from './hooks/useAgentModels';
import { useAgentContext } from './hooks/useAgentContext';
import { useAgentChat } from './hooks/useAgentChat';

// Create a logger instance for the agent component
const logger = createLogger('agent');

declare global {
  interface Window {
    _readliteIframeElement?: HTMLIFrameElement | null;
  }
}

// Define component props
interface AgentUIProps {
  onClose?: () => void;
  isVisible: boolean;
  initialMessage?: string;
  article?: any; // Optional article context to use for the AI
  visibleContent?: string; // New prop for the content currently visible on screen
  baseFontSize: number; // New prop for base font size from reader
  baseFontFamily: string; // New prop for base font family from reader
  useStyleIsolation?: boolean; // New option to use Shadow DOM isolation
}

/**
 * Modern AgentUI component combining ReadLite, Cursor, and Claude UX elements
 * Optimized for token efficiency and mobile-friendly design
 */
export const AgentUI: React.FC<AgentUIProps> = ({ 
  onClose, 
  isVisible, 
  initialMessage,
  article,
  visibleContent,
  baseFontSize,
  baseFontFamily,
  useStyleIsolation = true
}) => {
  // Hooks
  const { t } = useI18n();
  const { theme } = useTheme();
  
  // Custom Hooks
  const { isAuth, isAuthLoading, authError, login, setAuthError } = useAgentAuth();
  const { modelsList, selectedModel, setSelectedModel } = useAgentModels(isAuth);
  
  // Local state for selection (driven by window message)
  // We keep this here because it involves a window event listener specific to the UI
  const [selectedText, setSelectedText] = React.useState<string>('');
  
  const { 
    conversationManager, 
    activeContext,
    clearConversationManager
  } = useAgentContext(
    article, 
    visibleContent, 
    selectedText, 
    selectedModel?.contextWindow
  );
  
  const {
    messages,
    inputText,
    setInputText,
    isLoading,
    isThinking,
    isProcessing,
    error,
    streamingResponse,
    handleSendMessage,
    handleRetry,
    clearMessages,
    lastFailedMessage
  } = useAgentChat(
    conversationManager,
    activeContext,
    selectedModel,
    isAuth,
    t,
    initialMessage
  );

  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Sync error from auth hook to chat hook if needed, or just display authError in UI
  // Ideally, useAgentChat should handle its own errors, but authError is global.
  
  // Auto focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isVisible]);
  
  // Listen for selection message from the reader
  useEffect(() => {
    const handleSelectionMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'ASK_AI_WITH_SELECTION') {
        const text = event.data.selectedText;
        if (text && typeof text === 'string') {
          setSelectedText(text);
          setInputText(`${t('explainSelection') || 'Explain this text'}`);
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }
      }
    };
    
    window.addEventListener('message', handleSelectionMessage);
    return () => {
      window.removeEventListener('message', handleSelectionMessage);
    };
  }, [t, setInputText]);
  
  // Render markdown function
  const renderMarkdown = (text: string) => {
    try {
      const htmlContent = marked.parse(text, { breaks: true }) as string;
      return { __html: htmlContent };
    } catch (error) {
      logger.error("Error rendering markdown:", error);
      return { __html: text };
    }
  };
  
  // Get context label
  const getContextTypeLabel = (type: ContextType): string => {
    switch (type) {
      case 'screen':
        return t('contextTypeScreen') || 'Screen';
      case 'article':
        return t('contextTypeArticle') || 'Article';
      case 'selection':
        return t('contextTypeSelection') || 'Selection';
      default:
        return type;
    }
  };

  const onClearConversation = useCallback(() => {
    clearMessages();
    clearConversationManager(initialMessage || t('welcomeMessage') || "I'm here to help you understand what's currently visible on your screen.");
  }, [clearMessages, clearConversationManager, initialMessage, t]);

  const onSendMessageWrapper = useCallback(() => {
    // If we have selected text, we want to make sure it's passed as reference
    // useAgentChat handles the context switching via activeContext which is derived in useAgentContext
    // We just need to trigger the send.
    // If selectedText is present, it will be the active context.
    handleSendMessage(undefined, undefined, selectedText);
  }, [handleSendMessage, selectedText]);
  
  // Combine errors
  const displayError = authError || error;

  // Render the AgentUI component
  const agentContent = (
    <div className="readlite-agent-container readlite-scope flex flex-col w-full h-full bg-bg-secondary text-text-primary relative"
      style={{ 
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontSize: `${baseFontSize}px`, 
        fontFamily: baseFontFamily || 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Show LoginPrompt if auth is loading or not authenticated */} 
      {isAuthLoading ? (
        <div className="flex justify-center items-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Checking authentication status...</p>
          </div>
        </div>
      ) : !isAuth ? (
        <LoginPrompt onLogin={login} t={t} error={authError || "Login required to use AI features."} />
      ) : (
        <>
          {/* Main messages container */}
          <div 
            ref={messagesContainerRef}
            className="flex-grow overflow-y-auto pt-2 px-4 pb-4 bg-bg-secondary"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: `var(--readlite-scrollbar-thumb) var(--readlite-scrollbar-track)`
            }}
          >
            <MessageList 
              t={t}
              messages={messages} 
              isThinking={isThinking} 
              streamingResponse={streamingResponse}
              contextType={activeContext}
              error={displayError}
              getContextTypeLabel={getContextTypeLabel}
              renderMarkdown={renderMarkdown}
              isLoading={isLoading}
              isError={!!displayError}
              errorMessage={displayError}
              retry={handleRetry}
            />
          </div>
          
          {/* Input area */}
          <InputArea
            t={t}
            inputText={inputText}
            setInputText={setInputText}
            isLoading={isLoading || isThinking}
            isProcessing={isProcessing}
            onSendMessage={onSendMessageWrapper}
            disableSend={isLoading || (!inputText.trim() && !lastFailedMessage)}
            activeContext={activeContext}
            onClearSelection={() => setSelectedText('')}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            availableModels={modelsList}
            isAuth={isAuth}
            onClearConversation={onClearConversation}
            onLogin={login}
            onClose={onClose}
            selectedText={selectedText}
          />
        </>
      )}
    </div>
  );
  
  return useStyleIsolation ? (
    <StyleIsolator fitContent={true} theme={theme}>{agentContent}</StyleIsolator>
  ) : agentContent;
};

export default AgentUI; 