/**
 * Unified LLM Service
 * Consolidates LLM client functionality and reduces duplication
 */

import { createLogger } from '../utils/logger';
import { LLMRequestOptions } from '../utils/llm';

const logger = createLogger('llm-service');

// LLM message format for AI conversations
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Model settings configuration
export interface ModelSettings {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enableMem0?: boolean;
}

// Active stream tracking
interface StreamConnection {
  port: chrome.runtime.Port;
  streamId: string;
  onChunk: (chunk: string) => void;
}

class LLMService {
  private activeStreams: Map<string, StreamConnection> = new Map();

  /**
   * Generate text with streaming using port-based communication
   */
  async generateStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    settings: ModelSettings = {}
  ): Promise<string> {
    const streamId = this.generateStreamId();
    logger.info(`Starting stream ${streamId} with prompt: "${prompt.substring(0, 50)}..."`);

    return new Promise((resolve, reject) => {
      try {
        // Create communication port
        const port = chrome.runtime.connect({ name: `llm_stream_${streamId}` });
        let fullResponse = '';
        let receivedChunks = 0;

        // Store stream connection
        this.activeStreams.set(streamId, { port, streamId, onChunk });

        // Handle port disconnect
        port.onDisconnect.addListener(() => {
          logger.info(`Port disconnected for stream ${streamId}`);
          this.activeStreams.delete(streamId);
        });

        // Handle messages from background
        port.onMessage.addListener((message) => {
          if (!message) return;

          switch (message.type) {
            case 'LLM_STREAM_CHUNK':
              if (message.data?.chunk) {
                const chunk = message.data.chunk;
                receivedChunks++;
                fullResponse += chunk;
                onChunk(chunk);
                
                logger.debug(`Stream ${streamId} received chunk #${receivedChunks}`);
              }
              break;

            case 'LLM_STREAM_COMPLETE':
              logger.info(`Stream ${streamId} completed with ${receivedChunks} chunks`);
              port.disconnect();
              this.activeStreams.delete(streamId);
              resolve(fullResponse);
              break;

            case 'LLM_STREAM_ERROR':
              logger.error(`Stream ${streamId} error: ${message.error}`);
              port.disconnect();
              this.activeStreams.delete(streamId);
              
              // Return partial response if available
              if (receivedChunks > 0) {
                logger.info('Returning partial response despite error');
                resolve(fullResponse);
              } else {
                reject(new Error(message.error || 'Stream processing failed'));
              }
              break;
          }
        });

        // Send request through port
        const requestData = {
          type: 'LLM_STREAM_REQUEST',
          data: {
            prompt,
            options: this.buildRequestOptions(settings),
            streamId
          }
        };

        port.postMessage(requestData);
        logger.info(`Stream ${streamId} request sent`);

      } catch (error) {
        logger.error(`Stream ${streamId} setup error:`, error);
        this.activeStreams.delete(streamId);
        reject(error);
      }
    });
  }

  /**
   * Generate text from conversation messages
   */
  async generateFromMessages(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    settings: ModelSettings = {}
  ): Promise<string> {
    // Extract system prompt from system messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const systemPrompt = systemMessages.map(msg => msg.content).join('\n\n');

    // Find the last user message
    const userMessages = messages.filter(msg => msg.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    // Build conversation context (excluding system messages)
    const conversationContext = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    // Use the last user message as the main prompt
    const enhancedSettings: ModelSettings = {
      ...settings,
      systemPrompt: systemPrompt || settings.systemPrompt
    };

    return this.generateStream(lastUserMessage.content, onChunk, enhancedSettings);
  }

  /**
   * Build request options from settings
   */
  private buildRequestOptions(settings: ModelSettings): LLMRequestOptions {
    return {
      model: settings.model,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      systemPrompt: settings.systemPrompt,
      enableMem0: settings.enableMem0 ?? true,
      stream: true
    };
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cancel a specific stream
   */
  cancelStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      try {
        stream.port.disconnect();
        this.activeStreams.delete(streamId);
        logger.info(`Cancelled stream ${streamId}`);
      } catch (error) {
        logger.error(`Error cancelling stream ${streamId}:`, error);
      }
    }
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    logger.info(`Cancelling ${this.activeStreams.size} active streams`);
    
    this.activeStreams.forEach((stream, streamId) => {
      try {
        stream.port.disconnect();
      } catch (error) {
        logger.error(`Error disconnecting stream ${streamId}:`, error);
      }
    });
    
    this.activeStreams.clear();
  }

  /**
   * Get list of available models from API
   */
  async getModels(forceRefresh = false): Promise<any[]> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MODELS_REQUEST',
        forceRefresh
      });

      if (response.success) {
        return response.data || [];
      } else {
        logger.error('Failed to get models:', response.error);
        return [];
      }
    } catch (error) {
      logger.error('Error fetching models:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.cancelAllStreams();
  }
}

// Export singleton instance
export const llmService = new LLMService();