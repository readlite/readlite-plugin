/**
 * Simplified AI Client
 * Uses the unified LLM service for all AI interactions
 */

import { llmService, AIMessage, ModelSettings } from '../../services/llmService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ai-client');

export class AIClient {
  private currentStreamId: string | null = null;

  /**
   * Generate a streaming response from conversation messages
   */
  async generateResponse(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    settings: ModelSettings = {}
  ): Promise<string> {
    try {
      logger.info(`Generating response for ${messages.length} messages`);
      
      // Cancel any existing stream
      if (this.currentStreamId) {
        this.cancelStream();
      }

      // Generate response using LLM service
      const response = await llmService.generateFromMessages(
        messages,
        onChunk,
        settings
      );

      logger.info('Response generation completed');
      return response;

    } catch (error) {
      logger.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Generate a simple text completion
   */
  async generateText(
    prompt: string,
    onChunk: (chunk: string) => void,
    settings: ModelSettings = {}
  ): Promise<string> {
    try {
      logger.info(`Generating text for prompt: "${prompt.substring(0, 50)}..."`);

      const response = await llmService.generateStream(
        prompt,
        onChunk,
        settings
      );

      logger.info('Text generation completed');
      return response;

    } catch (error) {
      logger.error('Error generating text:', error);
      throw error;
    }
  }

  /**
   * Get available models
   */
  async getModels(forceRefresh = false): Promise<any[]> {
    return llmService.getModels(forceRefresh);
  }

  /**
   * Cancel current stream
   */
  cancelStream(): void {
    if (this.currentStreamId) {
      llmService.cancelStream(this.currentStreamId);
      this.currentStreamId = null;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cancelStream();
    llmService.cleanup();
  }
}

// Export singleton instance
export const aiClient = new AIClient();