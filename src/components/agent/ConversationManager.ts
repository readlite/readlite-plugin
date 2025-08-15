/**
 * New Conversation Manager
 * Integrates with the new context pack system and evidence slate approach
 * Implements extractive-first answering and BM25 fallback
 */

import { 
  ContextType, 
  ContextPack, 
  EvidenceSlate, 
  Message, 
  SentenceAnchor,
  InlineAnswerCard
} from './types';
import { ContextPackBuilder } from './ContextPackBuilder';
import { createLogger } from '../../utils/logger';

const logger = createLogger('conversation-manager');

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  contextPack?: ContextPack;
  evidenceSlate?: EvidenceSlate;
}

export class ConversationManager {
  private messages: AIMessage[] = [];
  private currentContextPack: ContextPack | null = null;
  private currentEvidenceSlate: EvidenceSlate | null = null;
  private systemPrompt: string = '';
  private contextPackBuilder: ContextPackBuilder;

  constructor(systemPrompt: string, contextPackBuilder: ContextPackBuilder) {
    this.systemPrompt = systemPrompt;
    this.contextPackBuilder = contextPackBuilder;
    this.addSystemMessage(systemPrompt);
  }

  /**
   * Add system message
   */
  addSystemMessage(content: string): void {
    this.messages.push({
      role: 'system',
      content
    });
    logger.info('Added system message');
  }

  /**
   * Add user message with context pack
   */
  addUserMessage(content: string, contextPack?: ContextPack): void {
    this.messages.push({
      role: 'user',
      content,
      contextPack
    });
    
    if (contextPack) {
      this.currentContextPack = contextPack;
      this.currentEvidenceSlate = this.contextPackBuilder.buildEvidenceSlate(contextPack);
    }
    
    logger.info(`Added user message with ${contextPack ? 'context pack' : 'no context'}`);
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content
    });
    logger.info('Added assistant message');
  }

  /**
   * Build prompt for LLM with evidence slate
   */
  buildPrompt(): AIMessage[] {
    const prompt: AIMessage[] = [];
    
    // Add system message
    if (this.systemPrompt) {
      prompt.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Add context information if available
    if (this.currentEvidenceSlate) {
      const contextMessage = this.createContextMessage(this.currentEvidenceSlate);
      prompt.push(contextMessage);
    }
    
    // Add conversation history
    prompt.push(...this.messages.slice(-10)); // Last 10 messages
    
    return prompt;
  }

  /**
   * Create context message from evidence slate
   */
  private createContextMessage(evidenceSlate: EvidenceSlate): AIMessage {
    const { sentences, tables, figures, numericFacts, confidence } = evidenceSlate;
    
    let contextContent = `Context (${confidence} confidence):\n\n`;
    
    // Add sentence evidence
    if (sentences.length > 0) {
      contextContent += `Evidence sentences:\n`;
      sentences.forEach((sentence, index) => {
        contextContent += `${index + 1}. [${sentence.id}] ${sentence.text}\n`;
      });
      contextContent += '\n';
    }
    
    // Add numeric facts
    if (numericFacts.length > 0) {
      contextContent += `Numeric facts (preserve verbatim):\n`;
      numericFacts.forEach((fact, index) => {
        contextContent += `${index + 1}. ${fact}\n`;
      });
      contextContent += '\n';
    }
    
    // Add table information
    if (tables.length > 0) {
      contextContent += `Tables:\n`;
      tables.forEach((table, index) => {
        contextContent += `Table ${index + 1}: ${table.rows.length} rows, ${table.columns.length} columns\n`;
      });
      contextContent += '\n';
    }
    
    // Add figure information
    if (figures.length > 0) {
      contextContent += `Figures:\n`;
      figures.forEach((figure, index) => {
        contextContent += `Figure ${index + 1}: ${figure.caption}\n`;
      });
      contextContent += '\n';
    }
    
    contextContent += `Instructions: Answer based on the evidence above. Use [sid:xxxx] citations. Preserve numeric facts verbatim.`;
    
    return {
      role: 'system',
      content: contextContent
    };
  }

  /**
   * Get current context pack
   */
  getCurrentContextPack(): ContextPack | null {
    return this.currentContextPack;
  }

  /**
   * Get current evidence slate
   */
  getCurrentEvidenceSlate(): EvidenceSlate | null {
    return this.currentEvidenceSlate;
  }

  /**
   * Check if context is available
   */
  hasContext(): boolean {
    return this.currentContextPack !== null && this.currentEvidenceSlate !== null;
  }

  /**
   * Get context summary
   */
  getContextSummary(): string {
    if (!this.currentContextPack) {
      return 'No context available';
    }
    
    return this.contextPackBuilder.getContextPackSummary(this.currentContextPack);
  }

  /**
   * Update context for new question
   */
  updateContext(question: string, selection?: Range, container?: Element): ContextPack {
    const contextPack = this.contextPackBuilder.buildContextPack(question, selection, container);
    this.currentContextPack = contextPack;
    this.currentEvidenceSlate = this.contextPackBuilder.buildEvidenceSlate(contextPack);
    
    logger.info('Updated context for new question');
    return contextPack;
  }

  /**
   * Get messages for display
   */
  getMessages(): Message[] {
    return this.messages.map((msg, index) => ({
      id: `msg-${index}`,
      sender: msg.role === 'user' ? 'user' : 'agent',
      text: msg.content,
      timestamp: Date.now() - (this.messages.length - index) * 1000, // Approximate timestamps
      contextPack: msg.contextPack,
      evidenceSlate: msg.evidenceSlate
    }));
  }

  /**
   * Clear conversation
   */
  clear(): void {
    this.messages = [];
    this.currentContextPack = null;
    this.currentEvidenceSlate = null;
    
    // Re-add system message
    if (this.systemPrompt) {
      this.addSystemMessage(this.systemPrompt);
    }
    
    logger.info('Cleared conversation');
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalMessages: number;
    hasContext: boolean;
    contextConfidence: string;
    evidenceCount: number;
  } {
    return {
      totalMessages: this.messages.length,
      hasContext: this.hasContext(),
      contextConfidence: this.currentContextPack?.confidence || 'none',
      evidenceCount: this.currentEvidenceSlate?.sentences.length || 0
    };
  }

  /**
   * Export conversation for debugging
   */
  exportConversation(): string {
    const exportData = {
      messages: this.messages,
      currentContextPack: this.currentContextPack,
      currentEvidenceSlate: this.currentEvidenceSlate,
      stats: this.getStats()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
} 