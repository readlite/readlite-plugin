import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ContextType, Model } from '../../../types/agent';
import { createLogger } from '../../../utils/logger';
import chatService from '../ChatService'; // Using existing client for now
import ConversationManager from '../ConversationManager';

const logger = createLogger('useAgentChat');

export const useAgentChat = (
  conversationManager: ConversationManager,
  activeContext: ContextType,
  selectedModel: Model | null,
  isAuth: boolean,
  t: (key: string) => string,
  initialMessage?: string
) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string>('');

  // Cleanup event listeners when component unmounts
  useEffect(() => {
    return () => {
      chatService.cleanupStreamListeners();
    };
  }, []);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = initialMessage || t('welcomeMessage') || "I'm here to help you understand what's currently visible on your screen.";
      setMessages([
        {
          id: 'welcome',
          sender: 'agent',
          text: welcomeMessage,
          timestamp: Date.now(),
          contextType: 'screen'
        }
      ]);
      conversationManager.addAssistantMessage(welcomeMessage);
    }
  }, [initialMessage, t, messages.length, conversationManager]);

  const processUserMessage = useCallback(async (text: string, contextType: ContextType, referenceText: string) => {
    setIsLoading(true);
    setError(null);
    setIsThinking(true);
    setStreamingResponse('');

    if (!conversationManager.hasContext()) {
      let errorMessage = "No content available.";
      if (contextType === 'screen') errorMessage = "No content visible on screen.";
      else if (contextType === 'article') errorMessage = "No article content available.";
      else if (contextType === 'selection') errorMessage = "No text selection available.";
      
      setError(errorMessage);
      setIsLoading(false);
      setIsThinking(false);
      return;
    }

    let accumulatedResponse = '';

    try {
      const promptMessages = conversationManager.buildPrompt();
      
      // Get model settings
      const modelSettings = selectedModel ? {
        model: selectedModel.value,
        temperature: 0.7,
        maxTokens: Math.floor((selectedModel.contextWindow || 4000) * 0.8)
      } : {
        temperature: 0.7,
        maxTokens: 3200
      };

      await chatService.generateTextStream(
        promptMessages,
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
        contextType: contextType,
        reference: referenceText || undefined
      };

      setMessages(prev => [...prev, agentMessage]);
      conversationManager.addAssistantMessage(agentMessage.text);
      setStreamingResponse('');

    } catch (err) {
      logger.error("Error calling LLM API:", err);
      
      if (text && !lastFailedMessage) {
        setLastFailedMessage(text);
      }

      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errMsg.includes('401') || errMsg.includes('auth')) {
        setError("Authentication error. Please log in again.");
      } else {
        setError(errMsg);
      }

      if (accumulatedResponse) {
        setMessages(prev => [...prev, {
          id: `agent-error-${Date.now()}`,
          sender: 'agent',
          text: accumulatedResponse + "\n\n_(Response may be incomplete due to an error)_",
          timestamp: Date.now(),
          error: true,
          contextType: contextType
        }]);
        conversationManager.addAssistantMessage(accumulatedResponse);
      }
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      setIsProcessing(false);
    }
  }, [conversationManager, selectedModel, lastFailedMessage]);

  const handleSendMessage = useCallback(async (overrideText?: string, overrideContextType?: ContextType, overrideReference?: string) => {
    const textToSend = overrideText || inputText.trim() || lastFailedMessage;
    
    if ((!textToSend) || isLoading) return;
    if (!isAuth) {
      setError("Please log in to use the AI assistant feature.");
      return;
    }

    // Clear last failed if we are retrying or sending new
    if (textToSend) {
      setLastFailedMessage('');
    }

    const contextToUse = overrideContextType || activeContext;
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: Date.now(),
      contextType: contextToUse
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    conversationManager.addUserMessage(textToSend);

    await processUserMessage(textToSend, contextToUse, overrideReference || '');

  }, [inputText, lastFailedMessage, isLoading, isAuth, activeContext, conversationManager, processUserMessage]);

  const handleRetry = useCallback(() => {
    handleSendMessage();
  }, [handleSendMessage]);

  const clearMessages = useCallback(() => {
    const welcome = messages.find(m => m.id === 'welcome');
    setMessages(welcome ? [welcome] : []);
  }, [messages]);

  return {
    messages,
    setMessages, // Exposed for special cases (like clearing)
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
  };
};
