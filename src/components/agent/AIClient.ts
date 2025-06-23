/**
 * Simple AI client for LLM interactions
 * Uses the existing llmClient for API calls
 */

import { createLogger } from '../../utils/logger';
import { AIMessage } from './ConversationManager';
import llmClient from '../../utils/llmClient';

// Create a logger instance
const logger = createLogger('ai-client');

// Define model settings
export interface ModelSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIClient {
  /**
   * Generate a streaming response using the existing llmClient
   */
  async generateTextStream(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    modelSettings: ModelSettings = {}
  ): Promise<void> {
    try {
      logger.info(`Starting generateTextStream with ${messages.length} messages`);
      
      // Create the system prompt from system messages
      const systemMessages = messages.filter(msg => msg.role === 'system');
      let systemPrompt = '';
      
      if (systemMessages.length > 0) {
        systemPrompt = systemMessages.map(msg => msg.content).join('\n\n');
        logger.info(`System prompt created (${systemPrompt.length} chars)`);
      }
      
      // Find the most recent user message as the primary prompt
      const conversationMessages = messages.filter(msg => msg.role !== 'system');
      const lastUserMessage = [...conversationMessages].reverse().find(msg => msg.role === 'user');
      
      if (!lastUserMessage) {
        throw new Error('No user message found in conversation');
      }
      
      logger.info(`User prompt: "${lastUserMessage.content.substring(0, 50)}..."`);
      
      // Use the existing llmClient's generateTextStream method
      await llmClient.generateTextStream(
        lastUserMessage.content,
        onChunk,
        {
          systemPrompt: systemPrompt,
          model: modelSettings.model,
          maxTokens: modelSettings.maxTokens,
          temperature: modelSettings.temperature,
          enableMem0: true
        }
      );
      
      logger.info('Stream completed successfully');
      
    } catch (error) {
      logger.error('Error in text stream:', error);
      throw error;
    }
  }

  /**
   * Cleanup stream listeners
   */
  cleanupStreamListeners(): void {
    llmClient.cleanupStreamListeners();
  }
}

export default new AIClient(); 