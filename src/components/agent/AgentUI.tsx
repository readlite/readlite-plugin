/**
 * New Agent UI Component
 * Implements selection-first lens paradigm with inline answer cards
 * Integrates with new context pack system and evidence slate approach
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useI18n } from '~/context/I18nContext';
import { marked } from 'marked';
import { Model } from '../../types/api';
import { isAuthenticated, openAuthPage } from '../../utils/auth';
import { 
  Message, 
  ContextType, 
  InlineAnswerCard, 
  ContextPack,
  EvidenceSlate,
  SentenceAnchor
} from './types';
import { StyleIsolator } from '../../content';
import { useTheme } from '../../context/ThemeContext';
import { createLogger } from '../../utils/logger';
import { SentenceSegmenter } from './SentenceSegmenter';
import { ContextPackBuilder } from './ContextPackBuilder';
import { SelectionManager } from './SelectionManager';
import { ConversationManager } from './ConversationManager';
import InlineAnswerCardComponent from './InlineAnswerCard';
import LoginPrompt from './LoginPrompt';
import MessageList from './MessageList';
import InputArea from './InputArea';
import aiClient from './AIClient';
import { ExclamationCircleIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Create a logger instance for the agent component
const logger = createLogger('agent');

// Get summary instructions for the LLM
const getSummaryInstructions = (): string => {
  return `You are an assistant that helps users understand content currently visible on their screen. Your responses should:

1. Focus primarily on the content that is currently visible in the user's viewport
2. Provide explanations, summaries, or answer questions about the visible text
3. Be clear and concise, with accurate information
4. Use [sid:xxxx] citations when referencing specific sentences
5. Preserve numeric facts verbatim from the source
6. Adapt to the user's questions - they might ask about what they're currently reading

When responding to questions about what's visible:
- Prioritize the visible content over other context
- Be helpful even if only partial information is available
- If the user asks about something not in view, suggest they scroll to relevant sections

Respond directly to queries without meta-commentary like "Based on the visible content..."`;
};

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
 * New AgentUI component implementing selection-first lens paradigm
 * Integrates with new context pack system and inline answer cards
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
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [contextType, setContextType] = useState<ContextType>('viewport');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(true);
  const [selectedText, setSelectedText] = useState<string>('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string>('');
  
  // New state for inline answer cards
  const [currentInlineCard, setCurrentInlineCard] = useState<InlineAnswerCard | null>(null);
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  
  // Authentication state
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [modelsList, setModelsList] = useState<Model[]>([]);
  
  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // New system components
  const sentenceSegmenterRef = useRef<SentenceSegmenter | null>(null);
  const contextPackBuilderRef = useRef<ContextPackBuilder | null>(null);
  const selectionManagerRef = useRef<SelectionManager | null>(null);
  const conversationManagerRef = useRef<ConversationManager | null>(null);
  
  // Initialize new system components
  useEffect(() => {
    if (containerRef.current) {
      // Initialize sentence segmenter
      const sentenceSegmenter = new SentenceSegmenter();
      sentenceSegmenterRef.current = sentenceSegmenter;
      
      // Initialize context pack builder
      const contextPackBuilder = new ContextPackBuilder(sentenceSegmenter);
      contextPackBuilderRef.current = contextPackBuilder;
      
      // Initialize selection manager
      const selectionManager = new SelectionManager(sentenceSegmenter, contextPackBuilder);
      selectionManagerRef.current = selectionManager;
      
      // Initialize conversation manager
      const conversationManager = new ConversationManager(
        getSummaryInstructions(),
        contextPackBuilder
      );
      conversationManagerRef.current = conversationManager;
      
      // Initialize selection manager with container
      selectionManager.initialize(containerRef.current);
      
      // Setup event listeners for inline answer cards
      this.setupInlineCardListeners();
      
      logger.info('Initialized new agent system components');
    }
  }, []);
  
  // Setup event listeners for inline answer cards
  const setupInlineCardListeners = useCallback(() => {
    const handleShowInlineCard = (event: CustomEvent) => {
      setCurrentInlineCard(event.detail);
    };
    
    const handleCloseInlineCard = () => {
      setCurrentInlineCard(null);
    };
    
    document.addEventListener('showInlineAnswerCard', handleShowInlineCard as EventListener);
    document.addEventListener('closeInlineAnswerCard', handleCloseInlineCard);
    
    return () => {
      document.removeEventListener('showInlineAnswerCard', handleShowInlineCard as EventListener);
      document.removeEventListener('closeInlineCard', handleCloseInlineCard);
    };
  }, []);
  
  // Initialize authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = await isAuthenticated();
        setIsAuth(authStatus);
        setIsAuthLoading(false);
        setShowLoginPrompt(!authStatus);
        
        if (authStatus) {
          loadModels();
        }
      } catch (error) {
        logger.error('Error checking authentication:', error);
        setIsAuth(false);
        setIsAuthLoading(false);
        setShowLoginPrompt(true);
      }
    };
    
    checkAuth();
  }, []);
  
  // Load models
  const loadModels = useCallback(async (attempt = 1, maxAttempts = 3, delay = 1000) => {
    try {
      const models = await aiClient.getModels();
      if (models && models.length > 0) {
        setModelsList(models);
        logger.info(`Loaded ${models.length} models`);
      } else {
        throw new Error('No models returned');
      }
    } catch (error) {
      logger.error(`Failed to load models (attempt ${attempt}/${maxAttempts}):`, error);
      
      if (attempt < maxAttempts) {
        setTimeout(() => loadModels(attempt + 1, maxAttempts, delay * 2), delay);
      }
    }
  }, []);
  
  // Set default model
  useEffect(() => {
    if (modelsList.length > 0 && selectedModel === null) {
      const savedModelId = localStorage.getItem('readlite_selected_model');
      
      if (savedModelId) {
        const matchedModel = modelsList.find(model => model.value === savedModelId);
        if (matchedModel) {
          setSelectedModel(matchedModel);
          return;
        }
      }
      
      setSelectedModel(modelsList[0]);
    }
  }, [modelsList, selectedModel]);
  
  // Set initial agent message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = initialMessage || t('welcomeMessage') || "I'm here to help you understand what's currently visible on your screen. Select text and press Cmd/Ctrl+K for quick answers.";
      setMessages([{
        id: 'welcome',
        sender: 'agent',
        text: welcomeMessage,
        timestamp: Date.now()
      }]);
      
      if (conversationManagerRef.current) {
        conversationManagerRef.current.addAssistantMessage(welcomeMessage);
      }
    }
  }, [initialMessage, t]);
  
  // Auto focus input when component becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isVisible]);
  
  // Cleanup event listeners when component unmounts
  useEffect(() => {
    return () => {
      aiClient.cleanupStreamListeners();
      
      // Cleanup selection manager
      if (selectionManagerRef.current) {
        selectionManagerRef.current.destroy();
      }
    };
  }, []);
  
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
  
  // Get context type label
  const getContextTypeLabel = (type: ContextType): string => {
    switch (type) {
      case 'viewport':
        return t('contextTypeViewport') || 'Viewport';
      case 'article':
        return t('contextTypeArticle') || 'Article';
      case 'selection':
        return t('contextTypeSelection') || 'Selection';
      case 'table':
        return t('contextTypeTable') || 'Table';
      case 'figure':
        return t('contextTypeFigure') || 'Figure';
      default:
        return type;
    }
  };
  
  // Process user message with new context system
  const processUserMessage = useCallback(async () => {
    if (!conversationManagerRef.current) return;
    
    setIsLoading(true);
    setError(null);
    setIsThinking(true);
    setStreamingResponse('');
    
    try {
      // Update context for the new question
      const contextPack = conversationManagerRef.current.updateContext(
        inputText,
        undefined, // selection will be handled by selection manager
        containerRef.current || undefined
      );
      
      // Get prompt from conversation manager
      const messages = conversationManagerRef.current.buildPrompt();
      
      // Use appropriate model settings for API call
      const modelSettings = getModelSettings();
      
      // Use streaming API for more responsive experience
      let accumulatedResponse = '';
      await aiClient.generateTextStream(
        messages,
        (chunk: string) => {
          accumulatedResponse += chunk;
          setStreamingResponse(prev => prev + chunk);
        },
        modelSettings
      );
      
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: accumulatedResponse || "I couldn't generate a response. Please try again.",
        timestamp: Date.now(),
        contextPack
      };
      
      // Add agent response to conversation UI
      setMessages(prev => [...prev, agentMessage]);
      
      // Add agent response to conversation manager
      conversationManagerRef.current.addAssistantMessage(agentMessage.text);
      
      // Reset streaming response
      setStreamingResponse('');
      
    } catch (err) {
      logger.error("Error calling LLM API:", err);
      
      if (inputText.trim() && !lastFailedMessage) {
        setLastFailedMessage(inputText.trim());
      }
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred while generating a response';
      if (errorMessage.includes('401') || errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
        setError("Authentication error. Please log in again to continue using the AI assistant.");
        setIsAuth(false);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [inputText, lastFailedMessage]);
  
  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if ((!inputText.trim() && !lastFailedMessage) || isLoading) return;
    
    if (!isAuth) {
      setError("Please log in to use the AI assistant feature.");
      return;
    }
    
    const userInput = inputText.trim() || lastFailedMessage;
    
    if (inputText.trim()) {
      setLastFailedMessage('');
    }
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userInput,
      timestamp: Date.now(),
      contextType
    };
    
    // Add user message to conversation UI
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // Add user message to conversation manager
    if (conversationManagerRef.current) {
      conversationManagerRef.current.addUserMessage(userInput);
    }
    
    // Reset height of textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    // Process user message
    processUserMessage();
    
  }, [inputText, isLoading, isAuth, lastFailedMessage, processUserMessage, contextType]);
  
  // Handle inline card close
  const handleInlineCardClose = useCallback(() => {
    setCurrentInlineCard(null);
  }, []);
  
  // Handle follow-up question
  const handleFollowUpQuestion = useCallback((question: string) => {
    setInputText(question);
    setCurrentInlineCard(null);
    
    // Focus input and send message
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      handleSendMessage();
    }, 100);
  }, [handleSendMessage]);
  
  // Handle citation hover
  const handleCitationHover = useCallback((citationId: string) => {
    setHoveredCitation(citationId);
    
    // Highlight the source sentence
    if (sentenceSegmenterRef.current) {
      const anchor = sentenceSegmenterRef.current.getAnchor(citationId);
      if (anchor) {
        // Add temporary highlight class
        anchor.range.commonAncestorContainer.parentElement?.classList.add('citation-highlight');
      }
    }
  }, []);
  
  // Handle citation leave
  const handleCitationLeave = useCallback(() => {
    setHoveredCitation(null);
    
    // Remove temporary highlight
    document.querySelectorAll('.citation-highlight').forEach(el => {
      el.classList.remove('citation-highlight');
    });
  }, []);
  
  // Get model settings
  const getModelSettings = () => {
    if (!selectedModel) return {};
    
    return {
      model: selectedModel.value,
      maxTokens: selectedModel.maxTokens || 1000,
      temperature: 0.7
    };
  };
  
  // Refresh models list
  const refreshModelsList = useCallback(async (force = false) => {
    if (force || modelsList.length === 0) {
      await loadModels();
    }
  }, [loadModels, modelsList.length]);
  
  // Monitor for authentication status changes
  useEffect(() => {
    const authChangeListener = (message: any) => {
      if (message.type === 'AUTH_STATUS_CHANGED' && message.isAuthenticated !== undefined) {
        setIsAuth(message.isAuthenticated);
        setIsAuthLoading(false);
        setShowLoginPrompt(!message.isAuthenticated);
        
        if (message.isAuthenticated) {
          refreshModelsList(true);
        }
      }
    };
    
    // Listen for runtime messages
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(authChangeListener);
      return () => chrome.runtime.onMessage.removeListener(authChangeListener);
    }
  }, [refreshModelsList]);
  
  // Listen for model changes and save to localStorage
  useEffect(() => {
    if (selectedModel) {
      try {
        localStorage.setItem('readlite_selected_model', selectedModel.value);
        logger.info(`Saved selected model to localStorage: ${selectedModel.label}`);
      } catch (error) {
        logger.error('Error saving model to localStorage:', error);
      }
    }
  }, [selectedModel]);
  
  // Render the component
  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
      }`}
      style={{
        fontSize: `${baseFontSize}px`,
        fontFamily: baseFontFamily
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('aiAssistant') || 'AI Assistant'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getContextTypeLabel(contextType)} • {t('selectionFirst') || 'Selection-first'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList
            messages={messages}
            streamingResponse={streamingResponse}
            isThinking={isThinking}
            onCitationHover={handleCitationHover}
            onCitationLeave={handleCitationLeave}
          />
        </div>
        
        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <InputArea
            ref={inputRef}
            value={inputText}
            onChange={setInputText}
            onSend={handleSendMessage}
            isLoading={isLoading}
            placeholder={t('askQuestion') || "Ask a question or select text and press Cmd/Ctrl+K..."}
          />
        </div>
      </div>
      
      {/* Inline Answer Card */}
      {currentInlineCard && (
        <InlineAnswerCardComponent
          card={currentInlineCard}
          onClose={handleInlineCardClose}
          onFollowUpQuestion={handleFollowUpQuestion}
          onCitationHover={handleCitationHover}
          onCitationLeave={handleCitationLeave}
        />
      )}
      
      {/* Login Prompt */}
      {showLoginPrompt && (
        <LoginPrompt
          onLogin={() => openAuthPage()}
          onClose={() => setShowLoginPrompt(false)}
        />
      )}
      
      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <ExclamationCircleIcon className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentUI; 