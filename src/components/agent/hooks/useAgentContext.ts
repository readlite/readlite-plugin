import { useRef, useEffect, useState, useCallback } from 'react';
import ConversationManager from '../ConversationManager';
import { ContextType } from '../../../types/agent';
import { createLogger } from '../../../utils/logger';
import { useI18n } from '../../../context/I18nContext';

const logger = createLogger('useAgentContext');

// Get summary instructions for the LLM
const getSummaryInstructions = (): string => {
  return `You are an assistant that helps users understand content currently visible on their screen. Your responses should:

1. Focus primarily on the content that is currently visible in the user's viewport
2. Provide explanations, summaries, or answer questions about the visible text
3. Be clear and concise, with accurate information
4. Acknowledge when you don't have enough context (if the visible content is incomplete)
5. Adapt to the user's questions - they might ask about what they're currently reading

When responding to questions about what's visible:
- Prioritize the visible content over other context
- Be helpful even if only partial information is available
- If the user asks about something not in view, suggest they scroll to relevant sections

Respond directly to queries without meta-commentary like "Based on the visible content..."`;
};

export const useAgentContext = (
  article: any,
  visibleContent: string | undefined,
  selectedText: string,
  modelContextWindow?: number
) => {
  const { t } = useI18n();
  
  // Initialize conversation manager
  const conversationManagerRef = useRef<ConversationManager>(
    new ConversationManager(getSummaryInstructions())
  );

  // Derived active context based on availability
  const activeContext: ContextType = selectedText 
    ? 'selection' 
    : (article?.content ? 'article' : 'screen');

  // Update context in manager when data changes
  useEffect(() => {
    if (activeContext === 'screen' && visibleContent) {
      conversationManagerRef.current.setContext(
        'screen',
        visibleContent,
        article?.title || 'Current View',
        article?.url,
        article?.language
      );
    } else if (activeContext === 'article' && article?.content) {
      conversationManagerRef.current.setContext(
        'article',
        article.content,
        article.title || 'Untitled',
        article.url,
        article.language
      );
    } else if (activeContext === 'selection' && selectedText) {
      conversationManagerRef.current.setContext(
        'selection',
        selectedText,
        'Selected Text'
      );
    }
  }, [activeContext, visibleContent, article, selectedText]);

  // Update model context window if it changes
  useEffect(() => {
    if (modelContextWindow) {
      conversationManagerRef.current.setMaxContextWindow(modelContextWindow);
    }
  }, [modelContextWindow]);

  // Handle clearing conversation
  const clearConversationManager = useCallback((welcomeMessage?: string) => {
    conversationManagerRef.current.clearConversation();
    if (welcomeMessage) {
      conversationManagerRef.current.addAssistantMessage(welcomeMessage);
    }
  }, []);

  return {
    conversationManager: conversationManagerRef.current,
    activeContext,
    clearConversationManager
  };
};
