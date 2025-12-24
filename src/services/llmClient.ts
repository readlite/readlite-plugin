/**
 * LLM API client for ReadLite sidepanel
 * This client sends requests to the background service worker which then calls the actual LLM API
 */

// Import LLM request options type to maintain consistency with main LLM API
import { LLMRequestOptions } from './llm';
import { createLogger } from "../utils/logger";

// Create a logger for this module
const logger = createLogger('utils');

// Track active stream listeners to prevent memory leaks
const activeStreamListeners = new Map();


/**
 * LLM client API
 * Provides the same methods as the main LLM API, but calls via background service worker
 */
const llmClient = {
  
  /**
   * Generate text with streaming output
   * This method calls the background service worker to use the streaming API
   * and passes chunks of the response to the provided callback
   */
  generateTextStream: async (prompt: string, onChunk: (chunk: string) => void, options: LLMRequestOptions = {}) => {
    logger.info(`[DEBUG] llmClient.generateTextStream: Starting with prompt: "${prompt.substring(0, 30)}..."`);
    
    let fullResponse = '';
    let receivedChunks = 0;
    let streamId = Date.now().toString();
    
    // Create a unique ID for this stream to properly track and remove listeners
    streamId = `stream_${streamId}_${Math.random().toString(36).substring(2, 9)}`;
    logger.info(`[DEBUG] llmClient.generateTextStream: Created stream ID: ${streamId}`);
    
    // Use port-based communication for more reliable streaming
    return new Promise((resolve, reject) => {
      try {
        // Create a communication port
        const port = chrome.runtime.connect({ name: `llm_stream_${streamId}` });
        let isPortDisconnected = false;
        
        // Set up disconnect event
        port.onDisconnect.addListener(() => {
          logger.info(`[DEBUG] llmClient.generateTextStream: Port disconnected`);
          isPortDisconnected = true;
          
          // Register this port/callback for cleanup
          activeStreamListeners.set(streamId, {
            port,
            onChunk
          });
        });
        
        // Listen for messages on the port
        port.onMessage.addListener((message) => {
          if (!message) {
            logger.info(`[DEBUG] llmClient.generateTextStream: Received empty message on port`);
            return;
          }
          
          if (message.type === 'LLM_STREAM_CHUNK') {
            if (message.data && typeof message.data.chunk === 'string') {
              const chunk = message.data.chunk;
              receivedChunks++;
              
              // Log chunk receipt (truncated for readability)
              const truncatedChunk = chunk.length > 20 ? chunk.substring(0, 20) + '...' : chunk;
              logger.info(`[DEBUG] llmClient.generateTextStream: Received chunk #${receivedChunks} on port: "${truncatedChunk}"`);
              
              // Add to full response
              fullResponse += chunk;
              
              // Pass to callback
              onChunk(chunk);
            }
          } else if (message.type === 'LLM_STREAM_COMPLETE') {
            logger.info(`[DEBUG] llmClient.generateTextStream: Stream completed successfully via port, received ${receivedChunks} chunks`);
            port.disconnect();
            resolve(fullResponse);
          } else if (message.type === 'LLM_STREAM_ERROR') {
            logger.error(`[ERROR] llmClient.generateTextStream: Error from background: ${message.error}`);
            port.disconnect();
            if (receivedChunks > 0) {
              // If we have a partial response, return it instead of failing completely
              logger.info(`[DEBUG] llmClient.generateTextStream: Returning partial response despite error`);
              resolve(fullResponse);
            } else {
              reject(new Error(message.error || "Unknown error in stream processing"));
            }
          }
        });
        
        // Send the request through the port
        logger.info(`[DEBUG] llmClient.generateTextStream: Sending stream request via port`);
        port.postMessage({ 
          type: 'LLM_STREAM_REQUEST',
          data: {
            prompt,
            options,
            streamId
          }
        });
      } catch (error) {
        logger.error(`[ERROR] llmClient.generateTextStream: Setup error: ${error instanceof Error ? error.message : String(error)}`);
        reject(error);
      }
    });
  },
  
  /**
   * Clean up stream listeners to prevent memory leaks
   * Important to call when component unmounts
   */
  cleanupStreamListeners: () => {
    logger.info(`[DEBUG] llmClient.cleanupStreamListeners: Cleaning up ${activeStreamListeners.size} listeners`);
    activeStreamListeners.forEach((listener, id) => {
      try {
        if (listener.port) {
          listener.port.disconnect();
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
    activeStreamListeners.clear();
  }
};

export default llmClient; 