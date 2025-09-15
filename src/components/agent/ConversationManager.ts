/**
 * Simple conversation manager for AI interactions
 * Handles messages and context without complex tokenization
 */

import { ContextType } from "./types";
import { createLogger } from "../../utils/logger";

// Create a logger instance for the conversation manager
const logger = createLogger("conversation-manager");

// Token estimation constants
const ESTIMATED_TOKENS_PER_CHAR = 0.25; // Rough estimation
const MAX_CONTEXT_TOKENS = 4000; // Maximum tokens before confirmation
const CHUNK_SIZE_TOKENS = 2000; // Size of each chunk when splitting

interface ConversationContext {
  type: ContextType;
  content: string;
  title?: string;
  url?: string;
  language?: string;
  isChunked?: boolean; // Flag to indicate if context is being processed in chunks
  currentChunk?: number; // Current chunk being processed
  totalChunks?: number; // Total number of chunks
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ConversationManager {
  private messages: AIMessage[] = [];
  private currentContext: ConversationContext | null = null;
  private systemPrompt: string = "";
  private pendingLargeContext: ConversationContext | null = null; // Store large context pending confirmation
  private isAwaitingConfirmation: boolean = false; // Flag to track if waiting for user confirmation
  private confirmationCallback: ((confirmed: boolean) => void) | null = null; // Callback for confirmation

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
      role: "system",
      content,
    });
    logger.info("Added system message");
  }

  /**
   * Adds a user message to the conversation
   */
  addUserMessage(content: string): void {
    // Check if this is a confirmation response to a large context
    if (this.isAwaitingConfirmation) {
      const lowerContent = content.toLowerCase().trim();
      // Check for confirmation keywords
      if (
        lowerContent === "yes" ||
        lowerContent === "y" ||
        lowerContent === "confirm" ||
        lowerContent === "continue" ||
        lowerContent === "确认" ||
        lowerContent === "是"
      ) {
        // User confirmed, proceed with the large context
        this.handleConfirmation(true);
        // Still add the message to the conversation
        this.messages.push({
          role: "user",
          content,
        });
        logger.info(
          `User confirmed large article context with message: "${content}"`,
        );
        return;
      } else if (
        lowerContent === "no" ||
        lowerContent === "n" ||
        lowerContent === "cancel" ||
        lowerContent === "stop" ||
        lowerContent === "取消" ||
        lowerContent === "否"
      ) {
        // User declined, cancel the large context
        this.handleConfirmation(false);
        // Still add the message to the conversation
        this.messages.push({
          role: "user",
          content,
        });
        logger.info(
          `User declined large article context with message: "${content}"`,
        );
        return;
      }
    }

    // Regular user message
    this.messages.push({
      role: "user",
      content,
    });
    logger.info(
      `Added user message: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
    );
  }

  /**
   * Adds an assistant (AI) message to the conversation
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: "assistant",
      content,
    });
    logger.info("Added assistant message");
  }

  /**
   * Adds a confirmation message for large context
   */
  addConfirmationMessage(content: string): void {
    this.messages.push({
      role: "assistant",
      content,
    });
    logger.info("Added confirmation message");
  }

  /**
   * Estimate the number of tokens in a text
   * This is a rough estimation based on characters
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length * ESTIMATED_TOKENS_PER_CHAR);
  }

  /**
   * Check if context is large and would require chunking
   */
  isLargeContext(content: string): boolean {
    return this.estimateTokens(content) > MAX_CONTEXT_TOKENS;
  }

  /**
   * Sets the current context for the conversation
   * For large article contexts, no longer asks for user confirmation
   */
  setContext(
    type: ContextType,
    content: string,
    title?: string,
    url?: string,
    language?: string,
  ): void {
    // For article contexts, check the size but don't require confirmation
    if (type === "article" && this.isLargeContext(content)) {
      const estimatedTokens = this.estimateTokens(content);
      const estimatedChunks = Math.ceil(estimatedTokens / CHUNK_SIZE_TOKENS);

      logger.info(
        `Large article context detected: ~${estimatedTokens} tokens, will require ${estimatedChunks} chunks`,
      );

      // Create context with chunking enabled
      this.currentContext = {
        type,
        content,
        title,
        url,
        language,
        isChunked: true,
        currentChunk: 1,
        totalChunks: estimatedChunks,
      };

      // Add system message to indicate processing in chunks
      const chunkInfo = `Processing article in chunks (1 of ${estimatedChunks}).`;
      this.addSystemMessage(chunkInfo);

      logger.info(`Set ${type} context with chunking: ${title || "Untitled"}`);
      return;
    }

    // For normal contexts or non-article types, set directly
    this.currentContext = {
      type,
      content,
      title,
      url,
      language,
    };

    logger.info(`Set ${type} context: ${title || "Untitled"}`);
  }

  /**
   * Handle user confirmation response
   */
  private handleConfirmation(confirmed: boolean): void {
    // Guard against calling this method when not awaiting confirmation
    if (!this.isAwaitingConfirmation) {
      logger.warn("handleConfirmation called but not awaiting confirmation");
      return;
    }

    this.isAwaitingConfirmation = false;

    if (confirmed && this.pendingLargeContext) {
      // User confirmed, set the context
      this.currentContext = this.pendingLargeContext;
      logger.info(
        `User confirmed large context processing: ${this.pendingLargeContext.title || "Untitled"}`,
      );

      // Add system message to indicate processing in chunks
      const chunkInfo = `Processing article in chunks (${this.pendingLargeContext.currentChunk} of ${this.pendingLargeContext.totalChunks}).`;
      this.addSystemMessage(chunkInfo);
    } else {
      // User declined or no pending context
      logger.info(
        "User declined large context processing or no pending context",
      );
      this.currentContext = null;
    }

    // Clean up
    this.pendingLargeContext = null;

    // Call the callback if set
    if (this.confirmationCallback) {
      this.confirmationCallback(confirmed);
      this.confirmationCallback = null;
    }
  }

  /**
   * Reset confirmation state - can be called explicitly to cancel any pending confirmations
   */
  resetConfirmationState(): void {
    if (this.isAwaitingConfirmation) {
      logger.info("Resetting confirmation state");
      this.isAwaitingConfirmation = false;
      this.pendingLargeContext = null;

      // Call the callback with false if set
      if (this.confirmationCallback) {
        this.confirmationCallback(false);
        this.confirmationCallback = null;
      }
    }
  }

  /**
   * Advance to the next chunk of a large context
   * Returns true if successfully advanced, false if no more chunks
   */
  advanceToNextChunk(): boolean {
    if (!this.currentContext?.isChunked || !this.currentContext.totalChunks) {
      return false;
    }

    if (this.currentContext.currentChunk! >= this.currentContext.totalChunks) {
      return false; // No more chunks
    }

    // Increment the chunk counter
    this.currentContext.currentChunk!++;

    // Add system message to indicate processing in chunks
    const chunkInfo = `Processing article in chunks (${this.currentContext.currentChunk} of ${this.currentContext.totalChunks}).`;
    this.addSystemMessage(chunkInfo);

    logger.info(
      `Advanced to chunk ${this.currentContext.currentChunk} of ${this.currentContext.totalChunks}`,
    );
    return true;
  }

  /**
   * Gets the current context information
   */
  getContextInfo(): ConversationContext | null {
    return this.currentContext;
  }

  /**
   * Checks if any context is available
   */
  hasContext(): boolean {
    return !!this.currentContext && this.currentContext.content.length > 0;
  }

  /**
   * Check if currently awaiting user confirmation for large context
   * This now always returns false since we don't wait for confirmation
   */
  isAwaitingContextConfirmation(): boolean {
    return false; // Changed to always return false
  }

  /**
   * Builds a prompt for the AI using current context and conversation history
   */
  buildPrompt(): AIMessage[] {
    const prompt: AIMessage[] = [];

    // Start with system prompt if available
    if (this.systemPrompt) {
      prompt.push({
        role: "system",
        content: this.systemPrompt,
      });
    }

    // Format the current context as a system message
    if (this.currentContext) {
      let contextMessage = "";

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

      // For chunked content, add chunk information
      if (this.currentContext.isChunked) {
        contextMessage += `CHUNK: ${this.currentContext.currentChunk} of ${this.currentContext.totalChunks}\n`;
      }

      // Add separator before content
      contextMessage += `\n----- CONTENT -----\n\n`;

      // If chunked, extract just the current chunk
      let contextContent = this.currentContext.content;
      if (
        this.currentContext.isChunked &&
        this.currentContext.totalChunks! > 1
      ) {
        const totalContent = this.currentContext.content;
        const totalTokens = this.estimateTokens(totalContent);
        const chunkSize = Math.ceil(
          totalTokens / this.currentContext.totalChunks!,
        );

        // Calculate token positions for the current chunk
        const startPos = (this.currentContext.currentChunk! - 1) * chunkSize;
        const endPos = Math.min(startPos + chunkSize, totalTokens);

        // Convert token positions to character positions (approximate)
        const startChar = Math.floor(startPos / ESTIMATED_TOKENS_PER_CHAR);
        const endChar = Math.floor(endPos / ESTIMATED_TOKENS_PER_CHAR);

        // Extract the chunk
        contextContent = totalContent.substring(startChar, endChar);

        // Add a note about chunking
        contextContent = `[This is chunk ${this.currentContext.currentChunk} of ${this.currentContext.totalChunks}]\n\n${contextContent}`;
      }

      // Add the actual content
      contextMessage += contextContent;

      // Add as system message
      prompt.push({
        role: "system",
        content: contextMessage,
      });
    }

    // Get only user and assistant messages for conversation history
    // Keep only the last 10 messages to avoid large prompts
    const conversationHistory = this.messages
      .filter((msg) => msg.role === "user" || msg.role === "assistant")
      .slice(-10);

    // Add conversation history to the prompt
    return [...prompt, ...conversationHistory];
  }

  /**
   * Clears the conversation history but keeps the system prompt
   */
  clearConversation(): void {
    // Keep only system messages
    this.messages = this.messages.filter((msg) => msg.role === "system");
    // Reset context and confirmation state
    this.currentContext = null;
    this.pendingLargeContext = null;
    this.isAwaitingConfirmation = false;
    this.confirmationCallback = null;

    logger.info("Conversation cleared");
  }

  /**
   * Completely resets the conversation manager
   */
  reset(): void {
    this.messages = [];
    this.currentContext = null;
    this.pendingLargeContext = null;
    this.isAwaitingConfirmation = false;
    this.confirmationCallback = null;

    // Re-add system prompt if available
    if (this.systemPrompt) {
      this.addSystemMessage(this.systemPrompt);
    }

    logger.info("Conversation manager reset");
  }
}

export default ConversationManager;
