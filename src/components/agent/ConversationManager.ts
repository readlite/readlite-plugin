/**
 * Simple conversation manager for AI interactions
 * Handles messages and context with simple truncation
 */

import { ContextType, AIMessage } from '../../types/agent';
import { createLogger } from '../../utils/logger';

// Create a logger instance for the conversation manager
const logger = createLogger('conversation-manager');

// Token estimation constants
const ESTIMATED_TOKENS_PER_CHAR = 0.25; // Rough estimation
const DEFAULT_MAX_TOKENS = 128000; // Default max tokens if not specified
const SAFE_BUFFER_PERCENTAGE = 0.8; // Use 80% of max context

interface ConversationContext {
  type: ContextType;
  content: string;
  title?: string;
  url?: string;
  language?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ConversationManager {
  private messages: AIMessage[] = [];
  private currentContext: ConversationContext | null = null;
  private systemPrompt: string = '';
  
  // Default context limit in characters (approx 100k tokens)
  private contextCharLimit = Math.floor(DEFAULT_MAX_TOKENS * SAFE_BUFFER_PERCENTAGE / ESTIMATED_TOKENS_PER_CHAR);

  constructor(systemPrompt?: string) {
    if (systemPrompt) {
      this.systemPrompt = systemPrompt;
      this.addSystemMessage(systemPrompt);
    }
  }

  /**
   * Adds a system message to the conversation
   */
  addSystemMessage(content: string): void {
    this.messages.push({
      role: 'system',
      content
    });
    logger.info('Added system message');
  }

  /**
   * Adds a user message to the conversation
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content
    });
    logger.info(`Added user message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
  }

  /**
   * Adds an assistant (AI) message to the conversation
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content
    });
    logger.info('Added assistant message');
  }

  /**
   * Sets the current context for the conversation
   * Simply replaces the existing context
   */
  setContext(type: ContextType, content: string, title?: string, url?: string, language?: string): void {
    this.currentContext = {
      type,
      content,
      title,
      url,
      language
    };
    
    logger.info(`Set ${type} context: ${title || 'Untitled'} (${content.length} chars)`);
  }

  /**
   * Update the max context window size based on selected model
   * @param maxTokens The max context window of the model (e.g. 128000)
   */
  setMaxContextWindow(maxTokens: number): void {
    if (maxTokens > 0) {
      // Calculate character limit based on 80% of max tokens
      this.contextCharLimit = Math.floor(maxTokens * SAFE_BUFFER_PERCENTAGE / ESTIMATED_TOKENS_PER_CHAR);
      logger.info(`Updated context limit to ~${this.contextCharLimit} chars (${maxTokens} max tokens)`);
    }
  }

  /**
   * Checks if any context is available
   */
  hasContext(): boolean {
    return !!this.currentContext && this.currentContext.content.length > 0;
  }

  /**
   * Builds a prompt for the AI using current context and conversation history
   */
  buildPrompt(): AIMessage[] {
    const prompt: AIMessage[] = [];
    
    // Start with system prompt if available
    if (this.systemPrompt) {
      prompt.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Format the current context as a system message
    if (this.currentContext) {
      let contextMessage = '';
      
      // Include context type at the beginning
      contextMessage += `CONTENT TYPE: ${this.currentContext.type.toUpperCase()}\n\n`;
      
      // Add metadata if available
      if (this.currentContext.title) {
        contextMessage += `TITLE: ${this.currentContext.title}\n`;
      }
      
      if (this.currentContext.url) {
        contextMessage += `URL: ${this.currentContext.url}\n`;
      }
      
      if (this.currentContext.language) {
        contextMessage += `LANGUAGE: ${this.currentContext.language}\n`;
      }
      
      // Add separator before content
      contextMessage += `\n----- CONTENT -----\n\n`;
      
      // Truncate content if it exceeds the limit
      let contentToUse = this.currentContext.content;
      if (contentToUse.length > this.contextCharLimit) {
        logger.info(`Truncating content from ${contentToUse.length} to ${this.contextCharLimit} chars`);
        contentToUse = contentToUse.substring(0, this.contextCharLimit) + "\n...[Content Truncated]...";
      }
      
      // Add the actual content
      contextMessage += contentToUse;
      
      // Add as system message
      prompt.push({
        role: 'system',
        content: contextMessage
      });
    }
    
    // Get only user and assistant messages for conversation history
    // Keep last 20 messages
    const conversationHistory = this.messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-20);
    
    // Add conversation history to the prompt
    return [...prompt, ...conversationHistory];
  }

  /**
   * Clears the conversation history but keeps the system prompt
   */
  clearConversation(): void {
    // Keep only system messages
    this.messages = this.messages.filter(msg => msg.role === 'system');
    // Reset context
    this.currentContext = null;
    
    logger.info('Conversation cleared');
  }
}

export default ConversationManager; 