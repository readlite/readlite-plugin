/**
 * LLM API integration utility for ReadLite
 * Provides direct fetch implementation to interact with OpenRouter via ReadLite API.
 */

import { getAuthToken, handleTokenExpiry } from './auth';

import { createLogger } from "./logger";

// Create a logger for this module
const logger = createLogger('llm');

// --- Constants & Configuration ---

// Updated API endpoint
const API_ENDPOINT = 'https://api.readlite.app/api/openrouter/chat/completions';
const DEFAULT_MAX_TOKENS = 4000;
const API_TIMEOUT_MS = 120000; // 120 seconds
// Default model ID to use as fallback when none specified
const FALLBACK_MODEL_ID = 'deepseek/deepseek-chat-v3-0324:free';

// --- Types ---

/** Interface for LLM request options */
export interface LLMRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
  enableMem0?: boolean;
  // Portkey specific options (if used directly)
  thinking?: {
    type: string;
    budget_tokens: number;
  };
}

/** Interface for chat messages */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// --- Core API Interaction (Direct Fetch) ---

/**
 * Direct fetch implementation for OpenRouter Chat Completions API.
 * Necessary for Service Worker compatibility where some libraries might fail.
 */
async function callLLMAPI(
  messages: ChatMessage[], 
  options: {
    model: string;
    maxTokens: number;
    temperature: number;
    stream?: boolean;
    enableMem0?: boolean;
  }
): Promise<any> { // Returns Response for stream, JSON object otherwise
  logger.debug(`Calling API with model: ${options.model}, stream: ${!!options.stream}`);
  
  const requestBody = {
    model: options.model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    messages: messages,
    stream: !!options.stream // Ensure boolean
  };
  
  try {
    // Get auth token
    const token = await getAuthToken();
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add X-Enable-Mem0 header (true by default)
    headers['X-Enable-Mem0'] = String(options.enableMem0 !== false);
    
    // Setup AbortController for request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      logger.warn(`Request timed out after ${API_TIMEOUT_MS}ms`);
    }, API_TIMEOUT_MS);
    
    logger.debug(`Requesting ${API_ENDPOINT}`);
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    
    // Clear timeout since request completed
    clearTimeout(timeoutId);
    
    logger.debug(`Response status: ${response.status}`);
    
    if (!response.ok) {
      let errorBody = 'Unknown error';
      try {
          errorBody = await response.text();
      } catch (e) { /* Ignore if reading body fails */ }
      
      // Check for 401 Unauthorized error specifically
      if (response.status === 401) {
        logger.error(`API request failed with 401 Unauthorized. Body: ${errorBody}`);
        // Handle token expiry and relogin
        await handleTokenExpiry(response);
        throw new Error(`Authentication failed: Your session has expired. Please log in again.`);
      }
      
      logger.error(`API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    // Return the raw Response for streaming, caller must handle body
    if (options.stream) {
      logger.debug(`Returning raw Response object for stream.`);
      return response;
    }
    
    // Parse and return JSON for non-streaming requests
    const responseData = await response.json();
    logger.debug(`API call successful (non-stream).`);
    return responseData;

  } catch (error) {
    // Check for AbortError (timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error(`Request timed out after ${API_TIMEOUT_MS}ms`);
      throw new Error(`Request timed out after ${API_TIMEOUT_MS / 1000} seconds`);
    }
    
    logger.error(`Network or fetch error:`, error);
    
    // Handle token expiry if it's an auth-related error
    const wasHandled = await handleTokenExpiry(error);
    if (wasHandled) {
      throw new Error('Authentication failed: Your session has expired. Please log in again.');
    }
    
    // Re-throw original error or a new standardized error
    throw error instanceof Error ? error : new Error('LLM API request failed.');
  }
}

/**
 * Generates text using the LLM with streaming response, handled through callbacks.
 * @param prompt The user's prompt.
 * @param onChunk Callback function that receives each chunk of text as it arrives.
 * @param options Configuration options for the LLM request.
 * @returns A Promise resolving to the complete generated text as a string.
 */
async function generateTextStreamInternal(
  prompt: string,
  onChunk: (text: string) => void,
  options: LLMRequestOptions = {}
): Promise<string> {
  logger.debug(`Stream request: "${prompt.substring(0, 50)}..."`, options);
  
  try {
    const messages: ChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const model = options.model || FALLBACK_MODEL_ID;
    const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
    const temperature = options.temperature ?? 0.7;
    const enableMem0 = options.enableMem0 !== false; // Default to true if not specified

    // Make the direct API call (streaming)
    logger.debug(`Calling callLLMAPI (stream)`);
    const streamResponse = await callLLMAPI(messages, { model, maxTokens, temperature, stream: true, enableMem0: true });

    // Process the stream
    const fullText = await processStreamInternal(streamResponse, onChunk);
    logger.debug(`Stream completed. Full text length: ${fullText.length}`);
    return fullText;

  } catch (error: unknown) {
    logger.error(`Stream failed:`, error);
    throw error instanceof Error ? error : new Error('Failed to generate streaming text.');
  }
}

/**
 * Process a stream response from the LLM API.
 * @param streamResponse The Response object from fetch with a readable stream.
 * @param onChunk Callback function to handle each chunk of text as it arrives.
 * @returns Promise resolving to the complete concatenated response.
 */
async function processStreamInternal(streamResponse: Response, onChunk: (text: string) => void): Promise<string> {
  if (!streamResponse.body) {
    throw new Error('No readable stream in the response');
  }

  const reader = streamResponse.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let completeResponse = '';
  
  // Set up stream chunk timeout
  let lastChunkTime = Date.now();
  const CHUNK_TIMEOUT_MS = 30000; // 30 seconds max wait between chunks
  const streamTimeoutId = setInterval(() => {
    const timeSinceLastChunk = Date.now() - lastChunkTime;
    if (timeSinceLastChunk > CHUNK_TIMEOUT_MS) {
      logger.warn(`Stream timed out - no chunks received for ${timeSinceLastChunk}ms`);
      clearInterval(streamTimeoutId);
      
      // We can't abort the reader directly, but we'll return what we have
      reader.cancel("Stream timed out").catch(e => {
        logger.error(`Error canceling stream reader: ${e}`);
      });
    }
  }, 5000); // Check every 5 seconds

  try {
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Update last chunk timestamp
      lastChunkTime = Date.now();
      
      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });
      
      // Process the chunk
      const dataLines = chunk
        .split('\n')
        .filter(line => line.trim().startsWith('data:'));
      
      for (const line of dataLines) {
        if (line.includes('[DONE]')) continue;
        
        try {
          // Get the data part after 'data:'
          const jsonStr = line.substring(line.indexOf('data:') + 5).trim();
          // Parse the JSON data
          const data = JSON.parse(jsonStr);
          // Extract text content
          const content = data?.choices?.[0]?.delta?.content || '';
          
          if (content) {
            onChunk(content);
            completeResponse += content;
          }
        } catch (e) {
          logger.warn("Error parsing stream chunk:", e, "Line:", line);
        }
      }
    }
    
    // Stream completed normally, clear timeout interval
    clearInterval(streamTimeoutId);
    return completeResponse;
  } catch (error) {
    // Clean up timeout on error
    clearInterval(streamTimeoutId);
    logger.error("Error processing stream:", error);
    throw error;
  }
}
// --- Exported Module --- 

const llmImplementation = {
  generateTextStream: generateTextStreamInternal,
};

// Export the chosen implementation
export default llmImplementation; 